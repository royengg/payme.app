import { Router } from "express";
import { prisma } from "../index";
import { paypalService } from "../services/paypal";
import { createInvoiceSchema, formatZodError } from "../validators/schemas";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const validation = createInvoiceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: formatZodError(validation.error) });
    }

    const { userId, guildId, clientDiscordId, clientEmail, amount, currency, description } = validation.data;

    const user = await prisma.user.findUnique({
      where: { id_guildId: { id: userId, guildId } }
    });

    if (!user?.paypalEmail) {
      return res.status(400).json({ 
        error: "PayPal email not configured. Use /setup command first." 
      });
    }

    if (!clientEmail) {
      const savedClient = await prisma.client.findUnique({
        where: {
          userId_guildId_discordId: {
            userId,
            guildId,
            discordId: clientDiscordId
          }
        }
      });
      
      if (savedClient?.email) {
        console.log(`[AddressBook] Using saved email for ${clientDiscordId}: ${savedClient.email}`);
      }
    }

    let effectiveClientEmail = clientEmail;
    if (!effectiveClientEmail) {
       const savedClient = await prisma.client.findUnique({
        where: {
          userId_guildId_discordId: {
            userId,
            guildId,
            discordId: clientDiscordId
          }
        }
      });
      if (savedClient?.email) effectiveClientEmail = savedClient.email;
    }

    if (!clientEmail) {
      const savedClient = await prisma.client.findUnique({
        where: {
          userId_guildId_discordId: {
            userId,
            guildId,
            discordId: clientDiscordId
          }
        }
      });
      
      if (savedClient?.email) {
        console.log(`[AddressBook] Found saved email for ${clientDiscordId}: ${savedClient.email}`);
      }
    }
    
    let finalClientEmail = clientEmail;
    if (!finalClientEmail) {
       const savedClient = await prisma.client.findUnique({
        where: {
          userId_guildId_discordId: {
            userId,
            guildId,
            discordId: clientDiscordId
          }
        }
      });
      if (savedClient?.email) finalClientEmail = savedClient.email;
    }

    const invoice = await prisma.invoice.create({
      data: {
        userId,
        guildId,
        clientDiscordId,
        clientEmail: effectiveClientEmail,
        amount,
        currency: currency || user.currency || "USD",
        description,
        status: "DRAFT"
      }
    });

    if (effectiveClientEmail) {
      try {
        const paypalInvoice = await paypalService.createInvoice({
          invoiceId: invoice.id,
          amount: Number(amount),
          currency: currency || user.currency || "USD",
          description,
          invoicerEmail: user.paypalEmail,
          recipientEmail: effectiveClientEmail
        });

        let updatedInvoice = await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            paypalInvoiceId: paypalInvoice.id,
            paypalLink: paypalInvoice.href,
            status: "DRAFT" 
          }
        });

        try {
          await paypalService.sendInvoice(paypalInvoice.id);

          updatedInvoice = await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: "SENT" }
          });
          
          return res.status(201).json(updatedInvoice);

        } catch (sendError: any) {
          console.error("PayPal send error:", sendError);
          return res.status(201).json({ 
            ...updatedInvoice, 
            warning: "Invoice created but email sending failed. Share the link manually." 
          });
        }

      } catch (paypalError) {
        console.error("PayPal create error:", paypalError);
        return res.status(201).json({ 
          ...invoice, 
          warning: "Failed to create PayPal invoice" 
        });
      }
    }

    res.status(201).json(invoice);
  } catch (error) {
    console.error("Create invoice error:", error);
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

router.get("/guild/:guildId", async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId, status } = req.query;

    const where: any = { guildId };
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50
    });

    res.json(invoices);
  } catch (error) {
    console.error("List invoices error:", error);
    res.status(500).json({ error: "Failed to list invoices" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id }
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    res.json(invoice);
  } catch (error) {
    console.error("Get invoice error:", error);
    res.status(500).json({ error: "Failed to get invoice" });
  }
});

router.patch("/:id/cancel", async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id }
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    if (invoice.status === "PAID") {
      return res.status(400).json({ error: "Cannot cancel a paid invoice" });
    }

    if (invoice.paypalInvoiceId) {
      try {
        await paypalService.cancelInvoice(invoice.paypalInvoiceId);
      } catch (paypalError) {
        console.error("PayPal cancel error:", paypalError);
      }
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status: "CANCELLED" }
    });

    res.json(updatedInvoice);
  } catch (error) {
    console.error("Cancel invoice error:", error);
    res.status(500).json({ error: "Failed to cancel invoice" });
  }
});


router.delete("/", async (req, res) => {
  try {
    const { userId, guildId, status } = req.query;

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const where: any = { 
      userId: String(userId), 
      guildId: String(guildId) 
    };
    if (status && status !== "ALL") where.status = String(status);

    const invoices = await prisma.invoice.findMany({ where });

    if (invoices.length === 0) {
      return res.json({ count: 0 });
    }

    console.log(`Deleting ${invoices.length} invoices...`);

    for (const invoice of invoices) {
      if (invoice.paypalInvoiceId) {
        try {
          if (invoice.status === "DRAFT") {
            await paypalService.deleteInvoice(invoice.paypalInvoiceId);
          } else if (invoice.status === "SENT") {
            await paypalService.cancelInvoice(invoice.paypalInvoiceId);
          }
        } catch (error) {
          console.error(`Failed to clean up invoice ${invoice.id} on PayPal:`, error);
        }
      }
    }

    const result = await prisma.invoice.deleteMany({ where });

    res.json({ count: result.count });
  } catch (error) {
    console.error("Delete invoices error:", error);
    res.status(500).json({ error: "Failed to delete invoices" });
  }
});

export default router;
