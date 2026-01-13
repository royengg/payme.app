import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import { getUser } from "../utils/api";

export const paylinkCommand = {
  data: new SlashCommandBuilder()
    .setName("paylink")
    .setDescription("Generate a PayPal.me payment link")
    .addNumberOption(option =>
      option
        .setName("amount")
        .setDescription("Payment amount")
        .setRequired(true)
        .setMinValue(0.01)
    )
    .addStringOption(option =>
      option
        .setName("description")
        .setDescription("What this payment is for")
        .setRequired(false)
        .setMaxLength(200)
    )
    .addStringOption(option =>
      option
        .setName("currency")
        .setDescription("Currency code (e.g., USD, EUR)")
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName("client")
        .setDescription("Send the link to this user via DM")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: ["Ephemeral"] });

    const amount = interaction.options.getNumber("amount", true);
    const description = interaction.options.getString("description") || "Payment";
    const currency = interaction.options.getString("currency")?.toUpperCase() || "USD";
    const client = interaction.options.getUser("client");

    // Check if user has PayPal.me username configured
    const userRes = await getUser(interaction.user.id, interaction.guildId!);
    if (userRes.error || !userRes.data) {
      return interaction.editReply({
        content: "❌ You need to set up PayMe first. Use `/setup paypal` to get started."
      });
    }

    const user = userRes.data as any;
    if (!user.paypalMeUsername) {
      return interaction.editReply({
        content: "❌ You haven't set up your PayPal.me username yet. Use `/setup paypalme <username>` to configure it."
      });
    }

    // Generate PayPal.me link
    // Format: paypal.me/username/amount
    const paypalMeUrl = `https://paypal.me/${user.paypalMeUsername}/${amount}${currency}`;
    const displayUrl = `paypal.me/${user.paypalMeUsername}/${amount}`;

    // Build the embed
    const embed = new EmbedBuilder()
      .setTitle("💳 Payment Link Generated")
      .setColor(0x0070ba) // PayPal blue
      .setDescription(`Share this link to receive **${currency} ${amount.toFixed(2)}**`)
      .addFields(
        { name: "📝 Description", value: description, inline: false },
        { name: "🔗 Payment Link", value: `\`${displayUrl}\``, inline: false }
      )
      .setFooter({ text: "Powered by PayPal.me" })
      .setTimestamp();

    // Create button for easy access
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel("Open Payment Link")
          .setStyle(ButtonStyle.Link)
          .setURL(paypalMeUrl)
          .setEmoji("💰")
      );

    // If client is specified, DM them
    if (client) {
      try {
        const clientEmbed = new EmbedBuilder()
          .setTitle("💳 Payment Request")
          .setColor(0x0070ba)
          .setDescription(`**${interaction.user.username}** is requesting a payment.`)
          .addFields(
            { name: "💵 Amount", value: `**${currency} ${amount.toFixed(2)}**`, inline: true },
            { name: "📝 For", value: description, inline: true },
            { name: "🔗 Pay Now", value: `[Click here to pay](${paypalMeUrl})`, inline: false }
          )
          .setFooter({ text: "Click the button below or use the link above" })
          .setTimestamp();

        const clientRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setLabel(`Pay ${currency} ${amount.toFixed(2)}`)
              .setStyle(ButtonStyle.Link)
              .setURL(paypalMeUrl)
              .setEmoji("💰")
          );

        await client.send({ embeds: [clientEmbed], components: [clientRow] });
        
        embed.addFields({ 
          name: "✅ Sent to Client", 
          value: `Payment link sent to ${client.username}`, 
          inline: false 
        });
      } catch {
        embed.addFields({ 
          name: "⚠️ DM Failed", 
          value: `Couldn't DM ${client.username}. Share the link manually.`, 
          inline: false 
        });
      }
    }

    await interaction.editReply({ embeds: [embed], components: [row] });
  }
};
