import { Router } from "express";
import { prisma } from "../index";

const router = Router();

router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { guildId } = req.query;

    const where: any = { userId };
    if (guildId) where.guildId = String(guildId);

    const invoices = await prisma.invoice.findMany({ where });

    const stats = {
      total: invoices.length,
      draft: 0,
      sent: 0,
      paid: 0,
      cancelled: 0,
      totalInvoiced: 0,
      totalPaid: 0,
      totalPending: 0,
      currencies: {} as Record<string, { invoiced: number; paid: number; pending: number }>
    };

    for (const inv of invoices) {
      const amount = Number(inv.amount);
      const currency = inv.currency;

      if (!stats.currencies[currency]) {
        stats.currencies[currency] = { invoiced: 0, paid: 0, pending: 0 };
      }

      switch (inv.status) {
        case "DRAFT":
          stats.draft++;
          break;
        case "SENT":
          stats.sent++;
          stats.totalInvoiced += amount;
          stats.totalPending += amount;
          stats.currencies[currency].invoiced += amount;
          stats.currencies[currency].pending += amount;
          break;
        case "PAID":
          stats.paid++;
          stats.totalInvoiced += amount;
          stats.totalPaid += amount;
          stats.currencies[currency].invoiced += amount;
          stats.currencies[currency].paid += amount;
          break;
        case "CANCELLED":
          stats.cancelled++;
          break;
      }
    }

    res.json(stats);
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export default router;
