import { Router } from "express";
import { prisma } from "../index";
import { sendPaymentNotification } from "../services/discord";

const router = Router();

router.post("/paypal", async (req, res) => {
  try {
    const event = req.body;
    
    console.log("PayPal webhook received:", event.event_type);
    console.log("Webhook payload:", JSON.stringify(event, null, 2));

    if (event.event_type === "INVOICING.INVOICE.PAID" || event.event_type === "INVOICES.INVOICE.PAID") {
      const paypalInvoiceId = event.resource?.invoice?.id || event.resource?.id;
      
      if (!paypalInvoiceId) {
        console.error("No invoice ID in webhook payload");
        return res.status(200).send("OK");
      }

      const invoice = await prisma.invoice.findUnique({
        where: { paypalInvoiceId },
        include: { 
          user: true,
          guild: true 
        }
      });

      if (!invoice) {
        console.log("Invoice not found for PayPal ID:", paypalInvoiceId);
        return res.status(200).send("OK");
      }

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { 
          status: "PAID",
          paidAt: new Date()
        }
      });

      console.log(`Invoice ${invoice.id} marked as PAID`);

      if (invoice.guild.webhookUrl) {
        await sendPaymentNotification({
          webhookUrl: invoice.guild.webhookUrl,
          invoiceId: invoice.id,
          amount: Number(invoice.amount),
          currency: invoice.currency,
          description: invoice.description,
          userId: invoice.userId,
          clientDiscordId: invoice.clientDiscordId
        });
      }
    }

    if (event.event_type === "INVOICING.INVOICE.CANCELLED" || event.event_type === "INVOICES.INVOICE.CANCELLED") {
      const paypalInvoiceId = event.resource?.invoice?.id || event.resource?.id;
      
      if (paypalInvoiceId) {
        await prisma.invoice.updateMany({
          where: { paypalInvoiceId },
          data: { status: "CANCELLED" }
        });
        console.log(`Invoice cancelled from PayPal: ${paypalInvoiceId}`);
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(200).send("OK");
  }
});

export default router;
