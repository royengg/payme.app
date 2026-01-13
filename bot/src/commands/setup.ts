import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits
} from "discord.js";
import { registerUser, getUser, registerGuild, updateGuildWebhook } from "../utils/api";

export const setupCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure PayMe settings")
    .addSubcommand(subcommand =>
      subcommand
        .setName("paypal")
        .setDescription("Set your PayPal business email")
        .addStringOption(option =>
          option
            .setName("email")
            .setDescription("Your PayPal business email")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("currency")
        .setDescription("Set your default currency")
        .addStringOption(option =>
          option
            .setName("code")
            .setDescription("Currency code (e.g., USD, EUR, GBP, INR)")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("webhook")
        .setDescription("Set the Discord webhook for payment notifications")
        .addStringOption(option =>
          option
            .setName("url")
            .setDescription("Discord webhook URL")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("paypalme")
        .setDescription("Set your PayPal.me username for quick payment links")
        .addStringOption(option =>
          option
            .setName("username")
            .setDescription("Your PayPal.me username (from paypal.me/YourUsername)")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("status")
        .setDescription("View your current PayMe configuration")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "paypal") {
      await handlePaypal(interaction);
    } else if (subcommand === "currency") {
      await handleCurrency(interaction);
    } else if (subcommand === "webhook") {
      await handleWebhook(interaction);
    } else if (subcommand === "paypalme") {
      await handlePaypalMe(interaction);
    } else if (subcommand === "status") {
      await handleStatus(interaction);
    }
  }
};

// Helper to ensure guild is registered
async function ensureGuild(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId || !interaction.guild) return;
  
  await registerGuild({
    id: interaction.guildId,
    name: interaction.guild.name
  });
}

async function handlePaypal(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const email = interaction.options.getString("email", true);

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return interaction.editReply({
      content: "❌ Please provide a valid email address."
    });
  }

  // Ensure guild exists first
  await ensureGuild(interaction);

  // Register/update user
  const result = await registerUser({
    id: interaction.user.id,
    guildId: interaction.guildId!,
    paypalEmail: email
  });

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to save PayPal email: ${result.error}`
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("✅ PayPal Email Configured")
    .setColor(0x00ff00)
    .setDescription(`Your PayPal business email has been set to:\n\`${email}\``)
    .addFields({
      name: "Next Steps",
      value: "You can now create invoices using `/invoice create`!"
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleCurrency(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const currency = interaction.options.getString("code", true).toUpperCase();

  // Common currency codes
  const validCurrencies = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "JPY", "CNY", "BRL", "MXN", "SGD", "HKD", "NZD", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF"];
  
  if (!validCurrencies.includes(currency) && currency.length !== 3) {
    return interaction.editReply({
      content: "❌ Invalid currency code. Use standard 3-letter codes like USD, EUR, GBP, INR, etc."
    });
  }

  // Ensure guild exists first
  await ensureGuild(interaction);

  // Use registerUser (upsert) to handle both create and update
  const result = await registerUser({
    id: interaction.user.id,
    guildId: interaction.guildId!,
    currency
  });

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to update currency: ${result.error}`
    });
  }

  await interaction.editReply({
    content: `✅ Default currency set to **${currency}**`
  });
}

async function handlePaypalMe(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const username = interaction.options.getString("username", true);

  // Validate username format (alphanumeric only)
  const usernameRegex = /^[a-zA-Z0-9]+$/;
  if (!usernameRegex.test(username)) {
    return interaction.editReply({
      content: "❌ PayPal.me username can only contain letters and numbers (no spaces or special characters)."
    });
  }

  if (username.length > 50) {
    return interaction.editReply({
      content: "❌ Username is too long. Maximum 50 characters."
    });
  }

  // Ensure guild exists first
  await ensureGuild(interaction);

  // Use registerUser (upsert) to handle both create and update
  const result = await registerUser({
    id: interaction.user.id,
    guildId: interaction.guildId!,
    paypalMeUsername: username
  });

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to save PayPal.me username: ${result.error}`
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("✅ PayPal.me Username Configured")
    .setColor(0x0070ba)
    .setDescription("Your PayPal.me username has been set!")
    .addFields(
      { 
        name: "🔗 Your Payment Link", 
        value: `[paypal.me/${username}](https://paypal.me/${username})`, 
        inline: false 
      },
      {
        name: "Next Steps",
        value: "Use `/paylink <amount>` to generate payment links with custom amounts!"
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleWebhook(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  // Check if user has admin permissions
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.editReply({
      content: "❌ Only server administrators can configure the webhook."
    });
  }

  const webhookUrl = interaction.options.getString("url", true);

  // Validate webhook URL
  if (!webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
    return interaction.editReply({
      content: "❌ Please provide a valid Discord webhook URL."
    });
  }

  // Register guild first if needed
  await ensureGuild(interaction);

  const result = await updateGuildWebhook(interaction.guildId!, webhookUrl);

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to save webhook: ${result.error}`
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("✅ Webhook Configured")
    .setColor(0x00ff00)
    .setDescription("Payment notifications will now be sent to the configured channel.")
    .addFields({
      name: "What happens now?",
      value: "When a client pays an invoice, a notification will be posted to the webhook channel."
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const userRes = await getUser(interaction.user.id, interaction.guildId!);

  const embed = new EmbedBuilder()
    .setTitle("⚙️ Your PayMe Configuration")
    .setColor(0x5865f2)
    .setTimestamp();

  if (userRes.error || !userRes.data) {
    embed.setDescription("You haven't set up PayMe yet.");
    embed.addFields({
      name: "Get Started",
      value: "Use `/setup paypal your@email.com` to configure your PayPal business email."
    });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = userRes.data as any;
    embed.addFields(
      { 
        name: "PayPal Email", 
        value: user.paypalEmail ? `\`${user.paypalEmail}\`` : "❌ Not set", 
        inline: true 
      },
      { 
        name: "PayPal.me Username", 
        value: user.paypalMeUsername ? `[paypal.me/${user.paypalMeUsername}](https://paypal.me/${user.paypalMeUsername})` : "❌ Not set", 
        inline: true 
      },
      { 
        name: "Default Currency", 
        value: user.currency || "USD", 
        inline: true 
      }
    );

    if (!user.paypalEmail) {
      embed.addFields({
        name: "⚠️ Action Required",
        value: "Set your PayPal email with `/setup paypal` to create invoices."
      });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}
