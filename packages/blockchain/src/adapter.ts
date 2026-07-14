import { MockBlockchainAdapter } from "./mock.js";

/**
 * Blockchain adapter interface.
 *
 * This file defines ONLY the contract. No implementation lives here — the mock
 * (and, in Phase 8, the real Polygon adapter) implement it. Keeping the
 * interface isolated makes the contract stable while adapters swap underneath.
 */
export interface BlockchainAdapter {
  /**
   * Anchor a certificate's hash on-chain.
   * @returns the transaction hash for the issuance.
   */
  issueCertificate(
    certificateId: string,
    hash: string,
  ): Promise<{ transactionHash: string }>;

  /** Read the anchored hash for a certificate, or null if not issued. */
  getHash(certificateId: string): Promise<string | null>;

  /** Revoke a previously issued certificate. */
  revoke(certificateId: string): Promise<void>;
}

/**
 * Factory seam for BlockchainAdapter selection.
 *
 * Phase 8 will branch on BLOCKCHAIN_MODE to return the real adapter; for now
 * it only returns the mock. Callers depend on this function, not on a concrete
 * class, so the Phase 8 swap is a one-line change here.
 */
export function getBlockchainAdapter(): BlockchainAdapter {
  return new MockBlockchainAdapter();
}
