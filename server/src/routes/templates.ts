import { Router } from "express";
import { prisma } from "../index";

import { createTemplateSchema, formatZodError } from "../validators/schemas";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const validation = createTemplateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: formatZodError(validation.error) });
    }

    const { userId, name, amount, currency, description } = validation.data;

    const template = await prisma.template.create({
      data: {
        userId,
        name,
        amount,
        currency: currency || "USD",
        description
      }
    });

    res.status(201).json(template);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Template with this name already exists" });
    }
    console.error("Create template error:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const templates = await prisma.template.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    res.json(templates);
  } catch (error) {
    console.error("List templates error:", error);
    res.status(500).json({ error: "Failed to list templates" });
  }
});

router.get("/user/:userId/name/:name", async (req, res) => {
  try {
    const { userId, name } = req.params;

    const template = await prisma.template.findUnique({
      where: { name_userId: { name, userId } }
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json(template);
  } catch (error) {
    console.error("Get template error:", error);
    res.status(500).json({ error: "Failed to get template" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.template.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Template not found" });
    }
    console.error("Delete template error:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

export default router;
