// veil-contract/src/types.rs
//
// Data types and storage keys for the VeilPool Soroban contract.

use soroban_sdk::{contracttype, Address, Bytes, BytesN, Vec};

// ── Storage keys ────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// USDC SAC token contract address
    UsdcToken,
    /// Cheese platform hot-wallet (withdrawal recipient, set on init)
    HotWallet,
    /// Contract admin (can update verifying key)
    Admin,
    /// Stored Groth16 verifying key
    VerifyingKey,
    /// Set of deposited commitments: Commitment(bytes32) → amount (i128 micro-USDC)
    Commitment(BytesN<32>),
    /// Set of spent nullifier hashes: Nullifier(bytes32) → invoice_ref (String)
    Nullifier(BytesN<32>),
}

// ── Groth16 Verifying Key ────────────────────────────────────────────────────
//
// All G1 points are 64 bytes:  x (32 bytes big-endian) || y (32 bytes big-endian)
// All G2 points are 128 bytes: x1 (32) || x0 (32) || y1 (32) || y0 (32) big-endian
//
// We store the NEGATED G2 points (-β, -γ, -δ) so that the pairing check becomes
// a simple product-equals-one check without needing G2 negation in the contract:
//
//   e(A, B) · e(α, −β) · e(vk_x, −γ) · e(C, −δ) = 1
//
// The TypeScript initializer negates the G2 points when calling init().

#[contracttype]
#[derive(Clone)]
pub struct VerifyingKey {
    /// vk_alpha_g1: G1 point  (64 bytes)
    pub alpha_g1: BytesN<64>,
    /// vk_beta_neg_g2: −β as G2 point  (128 bytes, negated)
    pub beta_neg_g2: Bytes,
    /// vk_gamma_neg_g2: −γ as G2 point  (128 bytes, negated)
    pub gamma_neg_g2: Bytes,
    /// vk_delta_neg_g2: −δ as G2 point  (128 bytes, negated)
    pub delta_neg_g2: Bytes,
    /// vk_ic: public-input accumulation bases  (N+1 G1 points, each 64 bytes)
    /// ic[0] is the constant term; ic[i] multiplied by public_input[i-1]
    pub ic: Vec<BytesN<64>>,
}

// ── Groth16 Proof ────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub struct Proof {
    /// proof.A: G1 point  (64 bytes)
    pub a: BytesN<64>,
    /// proof.B: G2 point  (128 bytes)
    pub b: Bytes,
    /// proof.C: G1 point  (64 bytes)
    pub c: BytesN<64>,
}

// ── Event types ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub struct DepositEvent {
    pub commitment: BytesN<32>,
    pub amount: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct WithdrawEvent {
    pub nullifier_hash: BytesN<32>,
    pub amount: i128,
    pub invoice_ref_hash: BytesN<32>,
}

// ── Errors ───────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized  = 1,
    NotInitialized      = 2,
    Unauthorized        = 3,
    CommitmentExists    = 4,
    CommitmentNotFound  = 5,
    NullifierSpent      = 6,
    InvalidProof        = 7,
    InvalidPublicInputs = 8,
    InsufficientBalance = 9,
}
