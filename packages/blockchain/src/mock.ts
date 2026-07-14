import { randomBytes } from "node:crypto";
import type { BlockchainAdapter } from "./adapter.js";

/**
 * In-memory mock of a blockchain adapter.
 *
 * Produces realistic-looking `0x` + 64-hex transaction hashes but performs no
 * real chain calls. State lives only in this process (not persisted) — fine
 * for a mock used through the end of Phase 5.
 */
export class MockBlockchainAdapter implements BlockchainAdapter {
  private readonly hashes = new Map<string, string>();
  private readonly revoked = new Set<string>();

  async issueCertificate(
    certificateId: string,
    _hash: string,
  ): Promise<{ transactionHash: string }> {
    const transactionHash = `0x${randomBytes(32).toString("hex")}`;
    this.hashes.set(certificateId, transactionHash);
    this.revoked.delete(certificateId);
    return { transactionHash };
  }

  async getHash(certificateId: string): Promise<string | null> {
    if (this.revoked.has(certificateId)) return null;
    return this.hashes.get(certificateId) ?? null;
  }

  async revoke(certificateId: string): Promise<void> {
    this.revoked.add(certificateId);
    this.hashes.delete(certificateId);
  }
}
