import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const token = process.env.TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages],
});

client.login(token);
