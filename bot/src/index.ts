import { Client, GatewayIntentBits, Collection, REST, Routes } from "discord.js";
import { invoiceCommand } from "./commands/invoice";
import { templateCommand } from "./commands/template";
import { setupCommand } from "./commands/setup";
import { paylinkCommand } from "./commands/paylink";

// Extend Client type to include commands collection
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

// Initialize commands collection
client.commands = new Collection();

// Register commands
const commands = [invoiceCommand, templateCommand, setupCommand, paylinkCommand];
commands.forEach(cmd => {
  client.commands.set(cmd.data.name, cmd);
});

// Ready event
client.once("clientReady", async () => {
  console.log(`🤖 Logged in as ${client.user?.tag}`);
  console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
  
  // Register slash commands
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

// Interaction handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

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
});

// Guild join event - register guild in database
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

// Login
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("❌ DISCORD_TOKEN is not set in environment variables");
  process.exit(1);
}

client.login(token);
