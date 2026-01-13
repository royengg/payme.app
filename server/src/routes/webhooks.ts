import { Router } from "express";
import { prisma } from "../index";
import { sendPaymentNotification } from "../services/discord";

const router = Router();

// PayPal webhook endpoint
router.post("/paypal", async (req, res) => {
  try {
    const event = req.body;
    
    console.log("PayPal webhook received:", event.event_type);

    // Handle invoice paid event
    if (event.event_type === "INVOICES.INVOICE.PAID") {
      const paypalInvoiceId = event.resource?.id;
      
      if (!paypalInvoiceId) {
        console.error("No invoice ID in webhook payload");
        return res.status(200).send("OK");
      }

      // Find and update our invoice
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

      // Update invoice status
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { 
          status: "PAID",
          paidAt: new Date()
        }
      });

      console.log(`Invoice ${invoice.id} marked as PAID`);

      // Send Discord notification via webhook
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

    // Handle invoice cancelled event
    if (event.event_type === "INVOICES.INVOICE.CANCELLED") {
      const paypalInvoiceId = event.resource?.id;
      
      if (paypalInvoiceId) {
        await prisma.invoice.updateMany({
          where: { paypalInvoiceId },
          data: { status: "CANCELLED" }
        });
        console.log(`Invoice cancelled from PayPal: ${paypalInvoiceId}`);
      }
    }

    // Always respond 200 to acknowledge receipt
    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Still return 200 to prevent PayPal retries
    res.status(200).send("OK");
  }
});

export default router;
