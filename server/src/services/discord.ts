interface PaymentNotificationParams {
  webhookUrl: string;
  invoiceId: string;
  amount: number;
  currency: string;
  description: string;
  userId: string;
  clientDiscordId: string;
}

export async function sendPaymentNotification(params: PaymentNotificationParams): Promise<void> {
  const { webhookUrl, invoiceId, amount, currency, description, userId, clientDiscordId } = params;

  const embed = {
    title: "💰 Payment Received!",
    color: 0x00ff00, 
    fields: [
      {
        name: "Invoice ID",
        value: `\`${invoiceId}\``,
        inline: true
      },
      {
        name: "Amount",
        value: `**${currency} ${amount.toFixed(2)}**`,
        inline: true
      },
      {
        name: "Description",
        value: description,
        inline: false
      },
      {
        name: "Client",
        value: `<@${clientDiscordId}>`,
        inline: true
      },
      {
        name: "Invoicer",
        value: `<@${userId}>`,
        inline: true
      }
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "PayMe Bot"
    }
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        embeds: [embed]
      })
    });

    if (!response.ok) {
      console.error("Discord webhook failed:", response.statusText);
    }
  } catch (error) {
    console.error("Discord webhook error:", error);
  }
}

export async function sendInvoiceCreatedNotification(params: {
  webhookUrl: string;
  invoiceId: string;
  amount: number;
  currency: string;
  description: string;
  userId: string;
  clientDiscordId: string;
  paymentLink?: string;
}): Promise<void> {
  const { webhookUrl, invoiceId, amount, currency, description, userId, clientDiscordId, paymentLink } = params;

  const fields = [
    {
      name: "Invoice ID",
      value: `\`${invoiceId}\``,
      inline: true
    },
    {
      name: "Amount",
      value: `**${currency} ${amount.toFixed(2)}**`,
      inline: true
    },
    {
      name: "Description",
      value: description,
      inline: false
    },
    {
      name: "Client",
      value: `<@${clientDiscordId}>`,
      inline: true
    },
    {
      name: "Created By",
      value: `<@${userId}>`,
      inline: true
    }
  ];

  if (paymentLink) {
    fields.push({
      name: "Payment Link",
      value: `[Click to Pay](${paymentLink})`,
      inline: false
    });
  }

  const embed = {
    title: "📄 Invoice Created",
    color: 0x5865f2, 
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: "PayMe Bot"
    }
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        embeds: [embed]
      })
    });

    if (!response.ok) {
      console.error("Discord webhook failed:", response.statusText);
    }
  } catch (error) {
    console.error("Discord webhook error:", error);
  }
}
