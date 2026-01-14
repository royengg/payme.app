import { z } from "zod";

export const createInvoiceSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  guildId: z.string().min(1, "Guild ID is required"),
  clientDiscordId: z.string().min(1, "Client Discord ID is required"),
  clientEmail: z.string().email("Invalid email format").optional(),
  amount: z.number().positive("Amount must be positive").max(1000000, "Amount too large"),
  currency: z.string().length(3, "Currency must be a 3-letter code").default("USD"),
  description: z.string().min(1, "Description is required").max(500, "Description too long")
});

export const createTemplateSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  amount: z.number().positive("Amount must be positive").max(1000000, "Amount too large"),
  currency: z.string().length(3, "Currency must be a 3-letter code").default("USD"),
  description: z.string().min(1, "Description is required").max(500, "Description too long")
});

export const registerUserSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  email: z.string().email("Invalid email format").optional(),
  paypalEmail: z.string().email("Invalid PayPal email format").optional(),
  paypalMeUsername: z.string().min(1).max(50).regex(/^[a-zA-Z0-9]+$/, "Username can only contain letters and numbers").optional(),
  currency: z.string().length(3, "Currency must be a 3-letter code").optional()
});

export const updateUserSchema = z.object({
  email: z.string().email("Invalid email format").optional(),
  paypalEmail: z.string().email("Invalid PayPal email format").optional(),
  paypalMeUsername: z.string().min(1).max(50).regex(/^[a-zA-Z0-9]+$/, "Username can only contain letters and numbers").optional(),
  currency: z.string().length(3, "Currency must be a 3-letter code").optional()
});

export const registerGuildSchema = z.object({
  id: z.string().min(1, "Guild ID is required"),
  name: z.string().min(1, "Guild name is required"),
  webhookUrl: z.string().url("Invalid webhook URL").startsWith("https://discord.com/api/webhooks/", "Must be a Discord webhook URL").optional()
});

export const updateGuildWebhookSchema = z.object({
  webhookUrl: z.string().url("Invalid webhook URL").startsWith("https://discord.com/api/webhooks/", "Must be a Discord webhook URL")
});

export const clientSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  guildId: z.string().min(1, "Guild ID is required"),
  discordId: z.string().min(1, "Discord ID is required"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address")
});

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}
