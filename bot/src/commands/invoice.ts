import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client
} from "discord.js";
import { createInvoice, listInvoices, cancelInvoice, deleteInvoice, remindInvoice, getUser } from "../utils/api";

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
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("delete")
        .setDescription("Permanently delete an invoice")
        .addStringOption(option =>
          option
            .setName("invoice_id")
            .setDescription("The invoice ID to delete")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("remind")
        .setDescription("Send a payment reminder for an invoice")
        .addStringOption(option =>
          option
            .setName("invoice_id")
            .setDescription("The invoice ID to send reminder for")
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction | any) {
    if (interaction.isButton()) {
      if (interaction.customId === "delete_all") {
        await handleDeleteAll(interaction);
      }
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      await handleCreate(interaction);
    } else if (subcommand === "list") {
      await handleList(interaction);
    } else if (subcommand === "cancel") {
      await handleCancel(interaction);
    } else if (subcommand === "delete") {
      await handleDelete(interaction);
    } else if (subcommand === "remind") {
      await handleRemind(interaction);
    }
  }
};

async function handleDeleteAll(interaction: any) {
  await interaction.deferReply({ flags: ["Ephemeral"] });
  
  const confirmEmbed = new EmbedBuilder()
    .setTitle("⚠️ Delete All Invoices?")
    .setColor(0xff0000)
    .setDescription("Are you sure you want to delete ALL your invoices? This will:\n- Delete DRAFT invoices from PayPal\n- Cancel SENT invoices on PayPal\n- Remove them from the database\n\n**This action cannot be undone.**");
    
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_delete")
        .setLabel("Yes, Delete Everything")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("cancel_delete")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
    );

  const msg = await interaction.editReply({
    embeds: [confirmEmbed],
    components: [row]
  });

  try {
    const confirmation = await msg.awaitMessageComponent({
      filter: (i: any) => i.user.id === interaction.user.id,
      time: 15000
    });

    if (confirmation.customId === "confirm_delete") {
      await confirmation.deferUpdate();
      
      const statusFilter = interaction.message.embeds[0].description.includes("status:") 
        ? interaction.message.embeds[0].description.split("status: ")[1].split(")")[0]
        : undefined;

      const result = await import("../utils/api").then(api => api.deleteInvoices(
        interaction.guildId,
        interaction.user.id,
        statusFilter
      ));

      if (result.error) {
        await confirmation.editReply({
          content: `❌ Failed to delete invoices: ${result.error}`,
          embeds: [],
          components: []
        });
      } else {
        await confirmation.editReply({
          content: `✅ Successfully deleted ${(result.data as any).count} invoices!`,
          embeds: [],
          components: []
        });
        
        try {
          await interaction.message.edit({
            content: "📭 Invoices deleted.",
            embeds: [],
            components: []
          });
        } catch (e) {
        }
      }
    } else {
      await confirmation.update({
        content: "❌ Deletion cancelled.",
        embeds: [],
        components: []
      });
    }
  } catch (e) {
    await interaction.editReply({
      content: "❌ Confirmation timed out.",
      embeds: [],
      components: []
    });
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const client = interaction.options.getUser("client", true);
  const amount = interaction.options.getNumber("amount", true);
  const description = interaction.options.getString("description", true);
  const currency = interaction.options.getString("currency") || "USD";
  const clientEmail = interaction.options.getString("email");

  const userRes = await getUser(interaction.user.id, interaction.guildId!);
  if (userRes.error || !userRes.data) {
    return interaction.editReply({
      content: "❌ You need to set up your PayPal email first. Use `/setup paypal` command."
    });
  }

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
    embed.setColor(0xffaa00);
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
    .setDescription(`Showing ${invoices.length} invoice(s)${status ? ` (Status: ${status})` : ""}`)
    .setTimestamp();

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

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("delete_all")
        .setLabel("🗑️ Delete All")
        .setStyle(ButtonStyle.Danger)
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
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

async function handleDelete(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const invoiceId = interaction.options.getString("invoice_id", true);

  const result = await deleteInvoice(invoiceId);

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to delete invoice: ${result.error}`
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Invoice Deleted")
    .setColor(0xff0000)
    .setDescription(`Invoice \`${invoiceId}\` has been permanently deleted.`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleRemind(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const invoiceId = interaction.options.getString("invoice_id", true);

  const result = await remindInvoice(invoiceId);

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to send reminder: ${result.error}`
    });
  }

  const data = result.data!;

  const embed = new EmbedBuilder()
    .setTitle("📧 Payment Reminder Sent")
    .setColor(0x5865f2)
    .setDescription(`A payment reminder has been sent for invoice \`${invoiceId}\`.`)
    .addFields(
      { name: "Amount", value: `**${data.currency} ${Number(data.amount).toFixed(2)}**`, inline: true },
      { name: "Client", value: `<@${data.clientDiscordId}>`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  if (data.clientDiscordId && data.paypalLink) {
    try {
      const client = await interaction.client.users.fetch(data.clientDiscordId);
      const dmEmbed = new EmbedBuilder()
        .setTitle("💳 Payment Reminder")
        .setColor(0xffaa00)
        .setDescription(`${interaction.user.username} has sent you a payment reminder.`)
        .addFields(
          { name: "Amount", value: `**${data.currency} ${Number(data.amount).toFixed(2)}**`, inline: true },
          { name: "Description", value: data.description, inline: false },
          { name: "Payment Link", value: `[Click here to pay](${data.paypalLink})`, inline: false }
        )
        .setFooter({ text: `Invoice ID: ${invoiceId}` })
        .setTimestamp();

      await client.send({ embeds: [dmEmbed] });

      await interaction.followUp({
        content: `✅ Discord DM also sent to <@${data.clientDiscordId}>`,
        flags: ["Ephemeral"]
      });
    } catch {
      await interaction.followUp({
        content: `⚠️ PayPal reminder sent, but couldn't DM <@${data.clientDiscordId}>`,
        flags: ["Ephemeral"]
      });
    }
  }
}

