import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder 
} from "discord.js";
import { saveClient, listClients, deleteClient, getUser } from "../utils/api";

export const clientCommand = {
  data: new SlashCommandBuilder()
    .setName("client")
    .setDescription("Manage your Address Book")
    .addSubcommand(subcommand =>
      subcommand
        .setName("add")
        .setDescription("Save a client to your address book")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("The Discord user")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("email")
            .setDescription("Client's PayPal Email")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("name")
            .setDescription("Nickname for this client")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("list")
        .setDescription("View your address book")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("delete")
        .setDescription("Remove a client from address book")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("The Discord user to remove")
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "add") {
      await handleAdd(interaction);
    } else if (subcommand === "list") {
      await handleList(interaction);
    } else if (subcommand === "delete") {
      await handleDelete(interaction);
    }
  }
};

async function handleAdd(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const clientUser = interaction.options.getUser("user", true);
  const email = interaction.options.getString("email", true);
  const name = interaction.options.getString("name", true);

  const userRes = await getUser(interaction.user.id);
  if (userRes.error || !userRes.data) {
    return interaction.editReply({
      content: "❌ You need to set up PayMe first. Use `/setup paypal` command."
    });
  }

  const result = await saveClient({
    userId: interaction.user.id,
    guildId: interaction.guildId!,
    discordId: clientUser.id,
    name,
    email
  });

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to save client: ${result.error}`
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("✅ Client Saved")
    .setColor(0x00ff00)
    .setDescription(`Saved **${name}** to your address book.`)
    .addFields(
      { name: "User", value: `<@${clientUser.id}>`, inline: true },
      { name: "Email", value: `\`${email}\``, inline: true }
    )
    .setFooter({ text: "Future invoices to this user will use this email automatically." })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleList(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const result = await listClients(interaction.guildId!, interaction.user.id);

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to fetch clients: ${result.error}`
    });
  }

  const clients = result.data as any[];

  if (!clients || clients.length === 0) {
    return interaction.editReply({
      content: "📭 Your address book is empty. Add a client with `/client add`."
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("📖 Address Book")
    .setColor(0x5865f2)
    .setDescription(`You have ${clients.length} saved client(s)`)
    .setTimestamp();

  for (const client of clients) {
    embed.addFields({
      name: client.name,
      value: `Discord: <@${client.discordId}>\nEmail: \`${client.email}\``,
      inline: false
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const clientUser = interaction.options.getUser("user", true);

  const result = await deleteClient(
    interaction.guildId!,
    interaction.user.id,
    clientUser.id
  );

  if (result.error) {
    return interaction.editReply({
      content: `❌ Failed to delete client: ${result.error}`
    });
  }

  await interaction.editReply({
    content: `🗑️ Removed <@${clientUser.id}> from your address book.`
  });
}
