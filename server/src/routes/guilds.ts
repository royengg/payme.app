import { Router } from "express";
import { prisma } from "../index";
import { registerGuildSchema, updateGuildWebhookSchema, formatZodError } from "../validators/schemas";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const validation = registerGuildSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: formatZodError(validation.error) });
    }

    const { id, name, webhookUrl } = validation.data;

    const guild = await prisma.guild.upsert({
      where: { id },
      update: {
        name,
        webhookUrl: webhookUrl || undefined
      },
      create: {
        id,
        name,
        webhookUrl
      }
    });

    res.json(guild);
  } catch (error) {
    console.error("Upsert guild error:", error);
    res.status(500).json({ error: "Failed to create/update guild" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const guild = await prisma.guild.findUnique({
      where: { id: req.params.id }
    });

    if (!guild) {
      return res.status(404).json({ error: "Guild not found" });
    }

    res.json(guild);
  } catch (error) {
    console.error("Get guild error:", error);
    res.status(500).json({ error: "Failed to get guild" });
  }
});

router.patch("/:id/webhook", async (req, res) => {
  try {
    const validation = updateGuildWebhookSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: formatZodError(validation.error) });
    }

    const { webhookUrl } = validation.data;

    const guild = await prisma.guild.update({
      where: { id: req.params.id },
      data: { webhookUrl }
    });

    res.json(guild);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Guild not found" });
    }
    console.error("Update guild webhook error:", error);
    res.status(500).json({ error: "Failed to update guild webhook" });
  }
});

export default router;
