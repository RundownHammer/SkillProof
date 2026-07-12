import type { Metadata } from "next";
import { canonicalCertificateExample } from "@credential/shared";

export const metadata: Metadata = {
  title: "SkillProof",
  description: "Blockchain-based skill credentialing system",
};

export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>SkillProof</h1>
      <p>Blockchain-based skill credentialing system (Phase 0 scaffold).</p>
      <p>
        Shared package link verified — sample certificate ID:{" "}
        <code>{canonicalCertificateExample.certificateId}</code>
      </p>
    </main>
  );
}
