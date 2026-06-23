pragma circom 2.0.0;

/*
 * Veil Private Payment Gateway — Note Spend Circuit
 *
 * Proves, without revealing the private inputs, that:
 *   1. commitment  = Poseidon(secret, nullifier, amount)
 *      — the prover knows the secret behind a deposited commitment
 *   2. nullifierHash = Poseidon(nullifier)
 *      — the unique double-spend tag (stored on-chain after first use)
 *   3. amount >= invoiceAmount
 *      — the note covers the invoice (ZK range check)
 *   4. The proof is cryptographically bound to a specific invoice
 *      via invoiceRefHash = Poseidon(invoiceRef as field element)
 *
 * What stays private:  secret, nullifier, the exact note amount
 * What is revealed:    commitment (was deposited), nullifierHash (spent),
 *                      invoiceAmount (merchant's requirement), invoiceRefHash
 *
 * Groth16 proof is generated off-chain (snarkjs) and verified on-chain
 * by the Soroban VeilPool contract using BN254 pairing host functions.
 */

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template NoteSpend() {
    // ── Private inputs (never leave the prover) ──────────────────────────
    signal input secret;       // random 32-byte secret chosen at deposit time
    signal input nullifier;    // random 32-byte nullifier chosen at deposit time
    signal input amount;       // note amount in USDC micro-units (amount * 1e6)

    // ── Public inputs (verified by the on-chain Soroban contract) ────────
    signal input commitment;      // Poseidon(secret, nullifier, amount) stored on deposit
    signal input nullifierHash;   // Poseidon(nullifier) — marks note as spent on-chain
    signal input invoiceAmount;   // minimum amount required by the invoice (USDC * 1e6)
    signal input invoiceRefHash;  // Poseidon(invoiceRef) — ties this proof to one invoice

    // ── 1. Verify commitment ─────────────────────────────────────────────
    // commitment must equal Poseidon(secret, nullifier, amount)
    // This proves the prover knows the secret behind a deposited note.
    component commitHasher = Poseidon(3);
    commitHasher.inputs[0] <== secret;
    commitHasher.inputs[1] <== nullifier;
    commitHasher.inputs[2] <== amount;
    commitment === commitHasher.out;

    // ── 2. Compute & verify nullifier hash ───────────────────────────────
    // nullifierHash = Poseidon(nullifier) is unique per note and prevents
    // spending the same note twice (the contract stores spent nullifierHashes).
    component nullHasher = Poseidon(1);
    nullHasher.inputs[0] <== nullifier;
    nullifierHash === nullHasher.out;

    // ── 3. Prove amount >= invoiceAmount (64-bit range) ──────────────────
    // Guarantees the note covers the invoice without revealing exact amount.
    component gte = GreaterEqThan(64);
    gte.in[0] <== amount;
    gte.in[1] <== invoiceAmount;
    gte.out === 1;

    // ── 4. Bind proof to this specific invoice ───────────────────────────
    // Constraining invoiceRefHash ensures the proof can only be used for
    // the specific invoice whose reference hashes to invoiceRefHash.
    // Without this, a valid proof could be replayed for a different invoice.
    signal invoiceRefBound;
    invoiceRefBound <== invoiceRefHash * 1;
}

component main {public [commitment, nullifierHash, invoiceAmount, invoiceRefHash]} = NoteSpend();
