import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder
} from "discord.js";

export const helpCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("View all available PayMe commands"),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle("💳 PayMe Commands")
      .setColor(0x5865f2)
      .setDescription("Your Discord invoicing assistant powered by PayPal")
      .addFields(
        {
          name: "🚀 Getting Started",
          value: [
            "`/setup paypal <email>` - Set your PayPal business email",
            "`/setup currency <code>` - Set default currency (USD, EUR, etc.)",
            "`/setup paypalme <username>` - Set PayPal.me username",
            "`/setup webhook [channel]` - Enable payment notifications",
            "`/setup status` - View your current configuration"
          ].join("\n"),
          inline: false
        },
        {
          name: "📄 Invoicing",
          value: [
            "`/invoice create` - Create and send a new invoice",
            "`/invoice list` - View your invoices",
            "`/invoice view <id>` - View invoice details",
            "`/invoice cancel <id>` - Cancel an invoice",
            "`/invoice remind <id>` - Send a payment reminder",
            "`/invoice delete` - Delete invoices"
          ].join("\n"),
          inline: false
        },
        {
          name: "📝 Templates",
          value: [
            "`/template create` - Create a reusable invoice template",
            "`/template list` - View your templates",
            "`/template use <name>` - Create invoice from template",
            "`/template delete <name>` - Delete a template"
          ].join("\n"),
          inline: false
        },
        {
          name: "👥 Clients",
          value: [
            "`/client add` - Save a client to your address book",
            "`/client list` - View saved clients",
            "`/client remove` - Remove a client"
          ].join("\n"),
          inline: false
        },
        {
          name: "🔗 Quick Payments",
          value: [
            "`/paylink <amount>` - Generate a PayPal.me payment link",
            "`/stats` - View your invoicing statistics"
          ].join("\n"),
          inline: false
        }
      )
      .setFooter({ text: "PayMe • Discord Invoicing Made Easy" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
