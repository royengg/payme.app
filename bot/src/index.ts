import { Client, GatewayIntentBits, Collection, REST, Routes } from "discord.js";
import { invoiceCommand } from "./commands/invoice";
import { templateCommand } from "./commands/template";
import { setupCommand } from "./commands/setup";
import { paylinkCommand } from "./commands/paylink";
import { clientCommand } from "./commands/client";
import { statsCommand } from "./commands/stats";
import { helpCommand } from "./commands/help";

declare module "discord.js" {
  interface Client {
    commands: Collection<string, any>;
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.commands = new Collection();

const commands = [invoiceCommand, templateCommand, setupCommand, paylinkCommand, clientCommand, statsCommand, helpCommand];
commands.forEach(cmd => {
  client.commands.set(cmd.data.name, cmd);
});

client.once("clientReady", async () => {
  console.log(`🤖 Logged in as ${client.user?.tag}`);
  console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
  
  const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
  
  try {
    console.log("🔄 Registering slash commands...");
    
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      { body: commands.map(cmd => cmd.data.toJSON()) }
    );
    
    console.log("✅ Slash commands registered successfully!");
  } catch (error) {
    console.error("Failed to register commands:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}:`, error);
      
      const errorMessage = "There was an error executing this command!";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
    return;
  }

  if (interaction.isButton()) {
    if (["delete_all", "confirm_delete", "cancel_delete"].includes(interaction.customId)) {
      try {
        await invoiceCommand.execute(interaction as any);
      } catch (error) {
        console.error("Button handling error:", error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "❌ Button interaction failed.", ephemeral: true });
        }
      }
    }
  }
});

client.on("guildCreate", async (guild) => {
  console.log(`📥 Joined new guild: ${guild.name} (${guild.id})`);
  
  try {
    await fetch(`${process.env.API_URL}/api/guilds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: guild.id, name: guild.name })
    });
  } catch (error) {
    console.error("Failed to register guild:", error);
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("❌ DISCORD_TOKEN is not set in environment variables");
  process.exit(1);
}

client.login(token);
