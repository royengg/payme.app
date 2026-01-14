import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder
} from "discord.js";
import { getStats, type StatsData } from "../utils/api";

export const statsCommand = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("View your invoicing statistics")
    .addStringOption(option =>
      option
        .setName("scope")
        .setDescription("View stats for this server or all servers")
        .setRequired(false)
        .addChoices(
          { name: "This Server", value: "server" },
          { name: "All Servers", value: "global" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: ["Ephemeral"] });

    const scope = interaction.options.getString("scope") || "server";
    const guildId = scope === "server" ? interaction.guildId! : undefined;

    const result = await getStats(interaction.user.id, guildId);

    if (result.error) {
      return interaction.editReply({
        content: `❌ Failed to fetch stats: ${result.error}`
      });
    }

    const stats = result.data as StatsData;

    if (stats.total === 0) {
      return interaction.editReply({
        content: "📊 You haven't created any invoices yet. Use `/invoice create` to get started!"
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("📊 Your Invoice Statistics")
      .setColor(0x5865f2)
      .setDescription(scope === "server" ? `Stats for this server` : `Stats across all servers`)
      .addFields(
        { name: "📄 Total Invoices", value: `${stats.total}`, inline: true },
        { name: "✅ Paid", value: `${stats.paid}`, inline: true },
        { name: "⏳ Pending", value: `${stats.sent}`, inline: true },
        { name: "📝 Draft", value: `${stats.draft}`, inline: true },
        { name: "❌ Cancelled", value: `${stats.cancelled}`, inline: true },
        { name: "\u200b", value: "\u200b", inline: true }
      )
      .setTimestamp();

    const currencies = Object.entries(stats.currencies);
    if (currencies.length > 0) {
      const currencyLines = currencies.map(([currency, data]) => {
        return `**${currency}**: ${data.paid.toFixed(2)} paid / ${data.pending.toFixed(2)} pending`;
      }).join("\n");

      embed.addFields({
        name: "💰 By Currency",
        value: currencyLines || "No data",
        inline: false
      });
    }

    const successRate = stats.total > 0 
      ? ((stats.paid / (stats.paid + stats.sent + stats.cancelled)) * 100).toFixed(1)
      : "0";

    embed.addFields({
      name: "📈 Success Rate",
      value: `${successRate}% of completed invoices were paid`,
      inline: false
    });

    await interaction.editReply({ embeds: [embed] });
  }
};
