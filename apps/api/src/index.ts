import "dotenv/config";
import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { prisma } from "@credential/database";
import { env } from "./env.js";
import testRouter from "./routes/test.js";

const app = express();

app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json());
app.use(clerkMiddleware());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "api",
    prismaClientLoaded: typeof prisma === "object",
  });
});

app.use("/test", testRouter);

app.listen(env.PORT, () => {
  console.log(`api listening on port ${env.PORT}`);
});
