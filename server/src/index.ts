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
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in .env file!");
  process.exit(1);
}

console.log("🔌 Connecting to database...");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/invoices", invoiceRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/users", userRoutes);
app.use("/api/guilds", guildRoutes);
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

export default app;
