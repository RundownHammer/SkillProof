import { describe, it, expect } from "vitest";
import { MockBlockchainAdapter } from "../src/mock.js";

const TX_HASH_RE = /^0x[0-9a-f]{64}$/;

describe("MockBlockchainAdapter", () => {
  it("issueCertificate returns a realistic 0x + 64-hex transaction hash", async () => {
    const adapter = new MockBlockchainAdapter();
    const { transactionHash } = await adapter.issueCertificate("CERT-1", "abc123");
    expect(transactionHash).toMatch(TX_HASH_RE);
  });

  it("getHash returns the issued hash and null before issuance", async () => {
    const adapter = new MockBlockchainAdapter();
    expect(await adapter.getHash("CERT-2")).toBeNull();
    const { transactionHash } = await adapter.issueCertificate("CERT-2", "deadbeef");
    expect(await adapter.getHash("CERT-2")).toBe(transactionHash);
  });

  it("revoke makes getHash return null afterward", async () => {
    const adapter = new MockBlockchainAdapter();
    await adapter.issueCertificate("CERT-3", "feedface");
    await adapter.revoke("CERT-3");
    expect(await adapter.getHash("CERT-3")).toBeNull();
  });

  it("each issuance produces a distinct hash", async () => {
    const adapter = new MockBlockchainAdapter();
    const a = await adapter.issueCertificate("CERT-A", "h1");
    const b = await adapter.issueCertificate("CERT-B", "h2");
    expect(a.transactionHash).not.toBe(b.transactionHash);
  });
});
