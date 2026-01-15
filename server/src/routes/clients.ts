import { Router } from "express";
import { prisma } from "../index";
import { formatZodError, clientSchema } from "../validators/schemas";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const validation = clientSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: formatZodError(validation.error) });
    }

    const { userId, guildId, discordId, name, email } = validation.data;

    const client = await prisma.client.upsert({
      where: {
        userId_guildId_discordId: {
          userId,
          guildId,
          discordId
        }
      },
      update: { name, email },
      create: {
        userId,
        guildId,
        discordId,
        name,
        email
      }
    });

    res.json(client);
  } catch (error) {
    console.error("Create client error:", error);
    res.status(500).json({ error: "Failed to save client" });
  }
});

router.get("/user/:userId/guild/:guildId", async (req, res) => {
  try {
    const { userId, guildId } = req.params;
    
    const clients = await prisma.client.findMany({
      where: { userId, guildId },
      orderBy: { name: "asc" }
    });

    res.json(clients);
  } catch (error) {
    console.error("List clients error:", error);
    res.status(500).json({ error: "Failed to list clients" });
  }
});

router.get("/user/:userId/guild/:guildId/client/:clientId", async (req, res) => {
  try {
    const { userId, guildId, clientId } = req.params;
    
    const client = await prisma.client.findUnique({
      where: { 
        userId_guildId_discordId: {
          userId,
          guildId,
          discordId: clientId
        }
      }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json(client);
  } catch (error) {
    console.error("Get client error:", error);
    res.status(500).json({ error: "Failed to get client" });
  }
});

router.delete("/user/:userId/guild/:guildId/client/:clientId", async (req, res) => {
  try {
    const { userId, guildId, clientId } = req.params;

    await prisma.client.delete({
      where: {
        userId_guildId_discordId: {
          userId,
          guildId,
          discordId: clientId
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Delete client error:", error);
    res.status(500).json({ error: "Failed to delete client" });
  }
});

export default router;
