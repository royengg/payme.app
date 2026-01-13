import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from "discord.js";
import { createTemplate, listTemplates, deleteTemplate, getTemplateByName, createInvoice, getUser } from "../utils/api";

export const templateCommand = {
  data: new SlashCommandBuilder()
    .setName("template")
    .setDescription("Manage invoice templates")
    .addSubcommand(subcommand =>
      subcommand
        .setName("create")
        .setDescription("Create a reusable invoice template")
        .addStringOption(option =>
          option
            .setName("name")
            .setDescription("Template name (e.g., 'Logo Design')")
            .setRequired(true)
            .setMaxLength(100)
        )
        .addNumberOption(option =>
          option
            .setName("amount")
            .setDescription("Default amount")
            .setRequired(true)
            .setMinValue(0.01)
        )
        .addStringOption(option =>
          option
            .setName("description")
            .setDescription("Default invoice description")
            .setRequired(true)
            .setMaxLength(500)
        )
        .addStringOption(option =>
          option
            .setName("currency")
            .setDescription("Currency code (e.g., USD, EUR)")
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("list")
        .setDescription("View your saved templates")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("use")
        .setDescription("Create an invoice from a template")
        .addStringOption(option =>
          option
            .setName("name")
            .setDescription("Template name to use")
            .setRequired(true)
        )
        .addUserOption(option =>
          option
            .setName("client")
            .setDescription("The Discord user to invoice")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("email")
            .setDescription("Client's PayPal email")
            .setRequired(false)
        )
        .addNumberOption(option =>
          option
            .setName("amount")
            .setDescription("Override template amount")
            .setRequired(false)
            .setMinValue(0.01)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("delete")
        .setDescription("Delete a template")
        .addStringOption(option =>
          option
            .setName("name")
            .setDescription("Template name to delete")
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      await handleCreate(interaction);
    } else if (subcommand === "list") {
      await handleList(interaction);
    } else if (subcommand === "use") {
      await handleUse(interaction);
    } else if (subcommand === "delete") {
      await handleDelete(interaction);
    }
  }
};

async function handleCreate(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const name = interaction.options.getString("name", true);
  const amount = interaction.options.getNumber("amount", true);
  const description = interaction.options.getString("description", true);
  const currency = interaction.options.getString("currency") || "USD";

  const result = await createTemplate({
    userId: interaction.user.id,
    guildId: interaction.guildId!,
    name,
    amount,
    currency: currency.toUpperCase(),
    description
  });

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to create template: ${result.error}`
    });
  }

  const template = result.data as any;

  const embed = new EmbedBuilder()
    .setTitle("📝 Template Created")
    .setColor(0x00ff00)
    .addFields(
      { name: "Name", value: template.name, inline: true },
      { name: "Amount", value: `${template.currency} ${Number(template.amount).toFixed(2)}`, inline: true },
      { name: "Description", value: description, inline: false }
    )
    .setFooter({ text: `Use with: /template use name:${name}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleList(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const result = await listTemplates(interaction.guildId!, interaction.user.id);

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to fetch templates: ${result.error}`
    });
  }

  const templates = result.data as any[];

  if (!templates || templates.length === 0) {
    return interaction.editReply({
      content: "📭 You don't have any templates yet. Create one with `/template create`!"
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("📋 Your Templates")
    .setColor(0x5865f2)
    .setDescription(`You have ${templates.length} template(s)`)
    .setTimestamp();

  for (const tmpl of templates.slice(0, 15)) {
    embed.addFields({
      name: `📄 ${tmpl.name}`,
      value: `**${tmpl.currency} ${Number(tmpl.amount).toFixed(2)}**\n${tmpl.description.substring(0, 80)}${tmpl.description.length > 80 ? "..." : ""}`,
      inline: true
    });
  }

  if (templates.length > 15) {
    embed.setFooter({ text: `Showing 15 of ${templates.length} templates` });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleUse(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const templateName = interaction.options.getString("name", true);
  const client = interaction.options.getUser("client", true);
  const clientEmail = interaction.options.getString("email");
  const amountOverride = interaction.options.getNumber("amount");

  // Check if user is set up
  const userRes = await getUser(interaction.user.id, interaction.guildId!);
  if (userRes.error || !userRes.data) {
    return interaction.editReply({
      content: "❌ You need to set up your PayPal email first. Use `/setup paypal` command."
    });
  }

  // Get the template
  const templateRes = await getTemplateByName(
    interaction.guildId!, 
    interaction.user.id, 
    templateName
  );

  if (templateRes.error || !templateRes.data) {
    return interaction.editReply({
      content: `❌ Template "${templateName}" not found. Use \`/template list\` to see your templates.`
    });
  }

  const template = templateRes.data as any;
  const amount = amountOverride || Number(template.amount);

  // Create invoice from template
  const result = await createInvoice({
    userId: interaction.user.id,
    guildId: interaction.guildId!,
    clientDiscordId: client.id,
    clientEmail: clientEmail || undefined,
    amount,
    currency: template.currency,
    description: template.description
  });

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to create invoice: ${result.error}`
    });
  }

  const invoice = result.data as any;

  const embed = new EmbedBuilder()
    .setTitle("📄 Invoice Created from Template")
    .setColor(0x5865f2)
    .addFields(
      { name: "Template", value: templateName, inline: true },
      { name: "Invoice ID", value: `\`${invoice.id}\``, inline: true },
      { name: "Amount", value: `**${invoice.currency} ${amount.toFixed(2)}**`, inline: true },
      { name: "Client", value: `<@${client.id}>`, inline: true },
      { name: "Status", value: invoice.status, inline: true }
    )
    .setTimestamp();

  if (invoice.paypalLink) {
    embed.addFields({ 
      name: "Payment Link", 
      value: `[Click to Pay](${invoice.paypalLink})`, 
      inline: false 
    });

    // DM client
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle("💳 You've Received an Invoice")
        .setColor(0x5865f2)
        .setDescription(`${interaction.user.username} has sent you an invoice.`)
        .addFields(
          { name: "Amount", value: `**${invoice.currency} ${amount.toFixed(2)}**`, inline: true },
          { name: "Description", value: template.description, inline: false },
          { name: "Payment Link", value: `[Click here to pay](${invoice.paypalLink})`, inline: false }
        )
        .setTimestamp();

      await client.send({ embeds: [dmEmbed] });
      embed.addFields({ name: "✅ DM Sent", value: `Invoice sent to ${client.username}`, inline: false });
    } catch {
      embed.addFields({ name: "⚠️ DM Failed", value: "Share the payment link manually.", inline: false });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const templateName = interaction.options.getString("name", true);

  // Get template first to get its ID
  const templateRes = await getTemplateByName(
    interaction.guildId!, 
    interaction.user.id, 
    templateName
  );

  if (templateRes.error || !templateRes.data) {
    return interaction.editReply({
      content: `❌ Template "${templateName}" not found.`
    });
  }

  const template = templateRes.data as any;
  const result = await deleteTemplate(template.id);

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to delete template: ${result.error}`
    });
  }

  await interaction.editReply({
    content: `🗑️ Template "${templateName}" has been deleted.`
  });
}
