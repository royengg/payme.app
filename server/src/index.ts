import express from "express";
import cors from "cors";
import { PrismaClient } from ".prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import invoiceRoutes from "./routes/invoices";
import templateRoutes from "./routes/templates";
import webhookRoutes from "./routes/webhooks";
import userRoutes from "./routes/users";
import guildRoutes from "./routes/guilds";
import clientRoutes from "./routes/clients";
import { requireApiKey } from "./middleware/auth";
import { paypalService } from "./services/paypal";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in .env file!");
  process.exit(1);
}

if (!process.env.API_SECRET) {
  console.error("⚠️  API_SECRET is not set - API authentication disabled!");
}

console.log("🔌 Connecting to database...");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    const paypal = await paypalService.healthCheck();
    res.json({
      status: paypal.ok ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services: { paypal }
    });
  } catch (error) {
    res.json({
      status: "error",
      timestamp: new Date().toISOString(),
      services: { paypal: { ok: false, latency: 0 } }
    });
  }
});

app.use("/api/invoices", requireApiKey, invoiceRoutes);
app.use("/api/templates", requireApiKey, templateRoutes);
app.use("/api/users", requireApiKey, userRoutes);
app.use("/api/guilds", requireApiKey, guildRoutes);
app.use("/api/clients", requireApiKey, clientRoutes);
app.use("/webhooks", webhookRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});

async function startServer() {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Database connected successfully!");
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
    process.exit(1);
  }
}

startServer();

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function autoCancelOverdueInvoices() {
  try {
    const cutoffDate = new Date(Date.now() - SIXTY_DAYS_MS);
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: "SENT",
        createdAt: { lt: cutoffDate }
      }
    });

    for (const invoice of overdueInvoices) {
      try {
        if (invoice.paypalInvoiceId) {
          await paypalService.cancelInvoice(invoice.paypalInvoiceId);
        }
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "CANCELLED" }
        });
      } catch (error) {
        console.error(`Failed to auto-cancel invoice ${invoice.id}:`, error);
      }
    }

    if (overdueInvoices.length > 0) {
      console.log(`🗑️ Auto-cancelled ${overdueInvoices.length} overdue invoice(s)`);
    }
  } catch (error) {
    console.error("Auto-cancel scheduler error:", error);
  }
}

setInterval(autoCancelOverdueInvoices, ONE_DAY_MS);
// Disabled: runs on first daily interval, not immediately on startup
// setTimeout(autoCancelOverdueInvoices, 10000);

export default app;
