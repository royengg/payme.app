import { Router } from "express";
import { prisma } from "../index";
import { paypalService } from "../services/paypal";
import { createInvoiceSchema, formatZodError } from "../validators/schemas";

const router = Router();

// Create a new invoice
router.post("/", async (req, res) => {
  try {
    // Validate request body with Zod
    const validation = createInvoiceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: formatZodError(validation.error) });
    }

    const { userId, guildId, clientDiscordId, clientEmail, amount, currency, description } = validation.data;

    // Get user's PayPal email
    const user = await prisma.user.findUnique({
      where: { id_guildId: { id: userId, guildId } }
    });

    if (!user?.paypalEmail) {
      return res.status(400).json({ 
        error: "PayPal email not configured. Use /setup command first." 
      });
    }

    // Create invoice in database
    const invoice = await prisma.invoice.create({
      data: {
        userId,
        guildId,
        clientDiscordId,
        clientEmail,
        amount,
        currency: currency || user.currency || "USD",
        description,
        status: "DRAFT"
      }
    });

    // Create PayPal invoice if client email is provided
    if (clientEmail) {
      try {
        const paypalInvoice = await paypalService.createInvoice({
          invoiceId: invoice.id,
          amount: Number(amount),
          currency: currency || user.currency || "USD",
          description,
          invoicerEmail: user.paypalEmail,
          recipientEmail: clientEmail
        });

        // Update our invoice with PayPal details immediately
        // This ensures checking the link works even if emailing fails
        let updatedInvoice = await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            paypalInvoiceId: paypalInvoice.id,
            paypalLink: paypalInvoice.href,
            status: "DRAFT" // Still draft until sent
          }
        });

        try {
          // Send the PayPal invoice
          await paypalService.sendInvoice(paypalInvoice.id);

          // Update status to SENT
          updatedInvoice = await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: "SENT" }
          });
          
          return res.status(201).json(updatedInvoice);

        } catch (sendError: any) {
          console.error("PayPal send error:", sendError);
          // Return the invoice with the link, but with a warning
          return res.status(201).json({ 
            ...updatedInvoice, 
            warning: "Invoice created but email sending failed. Share the link manually." 
          });
        }

      } catch (paypalError) {
        console.error("PayPal create error:", paypalError);
        // Return the draft invoice if creation fails
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

// List invoices for a guild
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

// Get a single invoice
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

// Cancel an invoice
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

    // Cancel on PayPal if it exists
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

export default router;
