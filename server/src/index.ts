import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import invoiceRoutes from "./routes/invoices";
import templateRoutes from "./routes/templates";
import webhookRoutes from "./routes/webhooks";
import userRoutes from "./routes/users";
import guildRoutes from "./routes/guilds";

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/invoices", invoiceRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/users", userRoutes);
app.use("/api/guilds", guildRoutes);
app.use("/webhooks", webhookRoutes);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;
