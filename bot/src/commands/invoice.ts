import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import { createInvoice, listInvoices, cancelInvoice, getUser } from "../utils/api";

export const invoiceCommand = {
  data: new SlashCommandBuilder()
    .setName("invoice")
    .setDescription("Manage invoices")
    .addSubcommand(subcommand =>
      subcommand
        .setName("create")
        .setDescription("Create and send an invoice")
        .addUserOption(option =>
          option
            .setName("client")
            .setDescription("The Discord user to invoice")
            .setRequired(true)
        )
        .addNumberOption(option =>
          option
            .setName("amount")
            .setDescription("Invoice amount")
            .setRequired(true)
            .setMinValue(0.01)
        )
        .addStringOption(option =>
          option
            .setName("description")
            .setDescription("What this invoice is for")
            .setRequired(true)
            .setMaxLength(500)
        )
        .addStringOption(option =>
          option
            .setName("currency")
            .setDescription("Currency code (e.g., USD, EUR, GBP)")
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName("email")
            .setDescription("Client's PayPal email (required for sending)")
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("list")
        .setDescription("View your invoices")
        .addStringOption(option =>
          option
            .setName("status")
            .setDescription("Filter by status")
            .setRequired(false)
            .addChoices(
              { name: "All", value: "ALL" },
              { name: "Draft", value: "DRAFT" },
              { name: "Sent", value: "SENT" },
              { name: "Paid", value: "PAID" },
              { name: "Cancelled", value: "CANCELLED" }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("cancel")
        .setDescription("Cancel a pending invoice")
        .addStringOption(option =>
          option
            .setName("invoice_id")
            .setDescription("The invoice ID to cancel")
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      await handleCreate(interaction);
    } else if (subcommand === "list") {
      await handleList(interaction);
    } else if (subcommand === "cancel") {
      await handleCancel(interaction);
    }
  }
};

async function handleCreate(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const client = interaction.options.getUser("client", true);
  const amount = interaction.options.getNumber("amount", true);
  const description = interaction.options.getString("description", true);
  const currency = interaction.options.getString("currency") || "USD";
  const clientEmail = interaction.options.getString("email");

  // Check if user is set up
  const userRes = await getUser(interaction.user.id, interaction.guildId!);
  if (userRes.error || !userRes.data) {
    return interaction.editReply({
      content: "❌ You need to set up your PayPal email first. Use `/setup paypal` command."
    });
  }

  // Create the invoice
  const result = await createInvoice({
    userId: interaction.user.id,
    guildId: interaction.guildId!,
    clientDiscordId: client.id,
    clientEmail: clientEmail || undefined,
    amount,
    currency: currency.toUpperCase(),
    description
  });

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to create invoice: ${result.error}`
    });
  }

  const invoice = result.data as any;

  // Build response embed
  const embed = new EmbedBuilder()
    .setTitle("📄 Invoice Created")
    .setColor(0x5865f2)
    .addFields(
      { name: "Invoice ID", value: `\`${invoice.id}\``, inline: true },
      { name: "Amount", value: `**${invoice.currency} ${amount.toFixed(2)}**`, inline: true },
      { name: "Status", value: invoice.status, inline: true },
      { name: "Client", value: `<@${client.id}>`, inline: true },
      { name: "Description", value: description, inline: false }
    )
    .setTimestamp();

  if (invoice.paypalLink) {
    embed.addFields({ 
      name: "Payment Link", 
      value: `[Click to Pay](${invoice.paypalLink})`, 
      inline: false 
    });

    // DM the client with payment link
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle("💳 You've Received an Invoice")
        .setColor(0x5865f2)
        .setDescription(`${interaction.user.username} has sent you an invoice.`)
        .addFields(
          { name: "Amount", value: `**${invoice.currency} ${amount.toFixed(2)}**`, inline: true },
          { name: "Description", value: description, inline: false },
          { name: "Payment Link", value: `[Click here to pay](${invoice.paypalLink})`, inline: false }
        )
        .setFooter({ text: `Invoice ID: ${invoice.id}` })
        .setTimestamp();

      await client.send({ embeds: [dmEmbed] });
      embed.addFields({ name: "✅ DM Sent", value: `Invoice sent to ${client.username}`, inline: false });
    } catch {
      embed.addFields({ name: "⚠️ DM Failed", value: "Couldn't DM client. Share the payment link manually.", inline: false });
    }
  } else if (invoice.warning) {
    embed.setColor(0xffaa00); // Orange for warning
    embed.addFields({ 
      name: "⚠️ PayPal Error", 
      value: invoice.warning + "\n(Invoice saved as Draft)", 
      inline: false 
    });
  } else if (!clientEmail) {
    embed.addFields({ 
      name: "⚠️ No PayPal Link", 
      value: "Provide client's email to generate a PayPal payment link.", 
      inline: false 
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleList(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const statusFilter = interaction.options.getString("status");
  const status = statusFilter === "ALL" ? undefined : statusFilter || undefined;

  const result = await listInvoices(
    interaction.guildId!, 
    interaction.user.id, 
    status
  );

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to fetch invoices: ${result.error}`
    });
  }

  const invoices = result.data as any[];

  if (!invoices || invoices.length === 0) {
    return interaction.editReply({
      content: "📭 You don't have any invoices yet. Create one with `/invoice create`!"
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("📋 Your Invoices")
    .setColor(0x5865f2)
    .setDescription(`Showing ${invoices.length} invoice(s)`)
    .setTimestamp();

  // Add up to 10 invoices
  const displayInvoices = invoices.slice(0, 10);
  for (const inv of displayInvoices) {
    const statusEmojis: Record<string, string> = {
      DRAFT: "📝",
      SENT: "📤",
      PAID: "✅",
      CANCELLED: "❌"
    };
    const statusEmoji = statusEmojis[inv.status] || "❓";

    embed.addFields({
      name: `${statusEmoji} ${inv.currency} ${Number(inv.amount).toFixed(2)}`,
      value: `ID: \`${inv.id}\`\n${inv.description.substring(0, 50)}${inv.description.length > 50 ? "..." : ""}`,
      inline: true
    });
  }

  if (invoices.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${invoices.length} invoices` });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleCancel(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const invoiceId = interaction.options.getString("invoice_id", true);

  const result = await cancelInvoice(invoiceId);

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to cancel invoice: ${result.error}`
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("🚫 Invoice Cancelled")
    .setColor(0xff0000)
    .setDescription(`Invoice \`${invoiceId}\` has been cancelled.`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
