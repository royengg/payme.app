# PayMe - Discord Invoicing Bot

**Freelance invoicing, directly inside Discord.**

PayMe helps you create professional PayPal invoices for your clients without leaving your Discord server. Your clients receive an invoice link via email or DM, and you get notified instantly when they pay.

## ✨ Features

- **Create Invoices**: Generate PayPal invoices with a single command.
- **Templates**: Save your frequent services (e.g., "Logo Design", "Server Setup") to reuse later.
- **Multi-Currency**: Support for USD, EUR, GBP, and more.
- **Instant Notifications**: Get alerted in your Discord channel the moment an invoice is paid.

## 🚀 How to Use

### 1. Setup
Before you start, make sure you have a **PayPal Business Account**.

- `/setup paypal [email]` - Link your PayPal Business email (where you receive money).
- `/setup currency [code]` - Set your default currency (e.g., USD).
- `/setup webhook [url]` - (Admin only) Set a channel for payment notifications.

### 2. Creating Invoices
You only need your client's PayPal email. They don't need to be on Discord.

- **Create an invoice:**
  `/invoice create amount:100 description:"Website Redesign" email:client@example.com`

  *The bot will generate a payment link that you can send to your client, or it will be emailed to them directly by PayPal.*

### 3. Using Templates
Save time on recurring jobs.

- **Create a template:**
  `/template create name:"Basic Fix" amount:50 description:"Hourly debugging rate"`

- **Use a template:**
  `/template use name:"Basic Fix" client:@ClientUser`

### 4. Manage Invoices
- `/invoice list` - See all your pending and paid invoices.
- `/invoice cancel` - Cancel an unpaid invoice.

## ❓ Frequently Asked Questions

**Q: Do my clients need to use this bot?**
A: No! Your clients just need a PayPal account (or a credit card) to pay the invoice link they receive in their email.

**Q: Where does the money go?**
A: Directly to your PayPal account. The bot just facilitates the creation of the invoice.

**Q: Is it secure?**
A: Yes. The bot uses the official PayPal Invoicing API. We never see your password or touch your funds.
