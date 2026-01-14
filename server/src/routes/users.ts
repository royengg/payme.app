import { Router } from "express";
import { prisma } from "../index";
import { registerUserSchema, updateUserSchema, formatZodError } from "../validators/schemas";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const validation = registerUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: formatZodError(validation.error) });
    }

    const { id, email, paypalEmail, paypalMeUsername, currency } = validation.data;

    const user = await prisma.user.upsert({
      where: { id },
      update: {
        email: email || undefined,
        paypalEmail: paypalEmail || undefined,
        paypalMeUsername: paypalMeUsername || undefined,
        currency: currency || undefined
      },
      create: {
        id,
        email,
        paypalEmail,
        paypalMeUsername,
        currency: currency || "USD"
      }
    });

    res.json(user);
  } catch (error) {
    console.error("Upsert user error:", error);
    res.status(500).json({ error: "Failed to create/update user" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: formatZodError(validation.error) });
    }

    const { email, paypalEmail, paypalMeUsername, currency } = validation.data;

    const user = await prisma.user.update({
      where: { id },
      data: {
        email: email || undefined,
        paypalEmail: paypalEmail || undefined,
        paypalMeUsername: paypalMeUsername || undefined,
        currency: currency || undefined
      }
    });

    res.json(user);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    console.error("Update user error:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

export default router;
