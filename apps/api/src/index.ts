import "dotenv/config";
import express from "express";
import { prisma } from "@credential/database";
import { canonicalCertificateExample } from "@credential/shared";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ok",
      database: "connected",
      sampleCertificateId: canonicalCertificateExample.certificateId,
    });
  } catch {
    res.status(200).json({
      status: "ok",
      database: "unavailable",
      sampleCertificateId: canonicalCertificateExample.certificateId,
    });
  }
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
