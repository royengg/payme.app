import { Router } from "express";
import type { Request } from "express";
import { prisma } from "../index";
import { sendPaymentNotification } from "../services/discord";

const router = Router();

async function verifyPayPalWebhook(req: Request): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.warn("PAYPAL_WEBHOOK_ID not set - skipping webhook verification");
    return true;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return false;

  const mode = process.env.PAYPAL_MODE || "sandbox";
  const baseUrl = mode === "live" 
    ? "https://api-m.paypal.com" 
    : "https://api-m.sandbox.paypal.com";

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    if (!tokenRes.ok) return false;
    const { access_token } = await tokenRes.json() as { access_token: string };

    const verifyRes = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        auth_algo: req.headers["paypal-auth-algo"],
        cert_url: req.headers["paypal-cert-url"],
        transmission_id: req.headers["paypal-transmission-id"],
        transmission_sig: req.headers["paypal-transmission-sig"],
        transmission_time: req.headers["paypal-transmission-time"],
        webhook_id: webhookId,
        webhook_event: req.body
      })
    });

    if (!verifyRes.ok) return false;
    const { verification_status } = await verifyRes.json() as { verification_status: string };
    return verification_status === "SUCCESS";
  } catch (error) {
    console.error("Webhook verification failed:", error);
    return false;
  }
}

router.post("/paypal", async (req, res) => {
  try {
    const isValid = await verifyPayPalWebhook(req);
    if (!isValid) {
      console.error("PayPal webhook signature verification failed");
      return res.status(401).send("Unauthorized");
    }

    const event = req.body;
    console.log("PayPal webhook received:", event.event_type);

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

