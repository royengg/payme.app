/**
 * PayPal Invoicing API Service
 * 
 * Handles all PayPal API interactions for invoice creation and management.
 * Uses OAuth 2.0 Bearer token authentication.
 */

interface CreateInvoiceParams {
  invoiceId: string;
  amount: number;
  currency: string;
  description: string;
  invoicerEmail: string;
  recipientEmail: string;
}

interface PayPalInvoice {
  id: string;
  href: string;
  status: string;
}

class PayPalService {
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    const mode = process.env.PAYPAL_MODE || "sandbox";
    this.baseUrl = mode === "live" 
      ? "https://api-m.paypal.com" 
      : "https://api-m.sandbox.paypal.com";
  }

  /**
   * Get OAuth access token (cached until expiry)
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("PayPal credentials not configured");
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    if (!response.ok) {
      throw new Error(`PayPal auth failed: ${response.statusText}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer

    return this.accessToken;
  }

  /**
   * Create a draft invoice
   */
  async createInvoice(params: CreateInvoiceParams): Promise<PayPalInvoice> {
    const token = await this.getAccessToken();

    const invoicePayload = {
      detail: {
        invoice_number: params.invoiceId,
        currency_code: params.currency,
        note: params.description,
        payment_term: {
          term_type: "NET_30"
        }
      },
      invoicer: {
        email_address: params.invoicerEmail
      },
      primary_recipients: [
        {
          billing_info: {
            email_address: params.recipientEmail
          }
        }
      ],
      items: [
        {
          name: params.description.substring(0, 100),
          quantity: "1",
          unit_amount: {
            currency_code: params.currency,
            value: params.amount.toFixed(2)
          }
        }
      ]
    };

    const response = await fetch(`${this.baseUrl}/v2/invoicing/invoices`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(invoicePayload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PayPal create invoice failed: ${error}`);
    }

    const invoice = await response.json() as PayPalInvoice;
    return invoice;
  }

  /**
   * Send a draft invoice to the recipient
   */
  async sendInvoice(paypalInvoiceId: string): Promise<void> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/invoicing/invoices/${paypalInvoiceId}/send`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          send_to_invoicer: true,
          send_to_recipient: true
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PayPal send invoice failed: ${error}`);
    }
  }

  /**
   * Cancel an invoice
   */
  async cancelInvoice(paypalInvoiceId: string): Promise<void> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/invoicing/invoices/${paypalInvoiceId}/cancel`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          send_to_invoicer: true,
          send_to_recipient: true,
          note: "Invoice cancelled"
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PayPal cancel invoice failed: ${error}`);
    }
  }

  /**
   * Get invoice details including payment link
   */
  async getInvoice(paypalInvoiceId: string): Promise<any> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/invoicing/invoices/${paypalInvoiceId}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PayPal get invoice failed: ${error}`);
    }

    return response.json();
  }
}

export const paypalService = new PayPalService();
