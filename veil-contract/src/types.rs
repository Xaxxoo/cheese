// veil-contract/src/types.rs
use soroban_sdk::{contracterror, contracttype, BytesN, String};

// ── Storage keys ────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// USDC SAC token contract address
    UsdcToken,
    /// Cheese platform hot-wallet (receives all withdrawals)
    HotWallet,
    /// Contract admin
    Admin,
    /// Authorised withdrawal operator (Cheese backend Stellar keypair)
    Operator,
    /// Deposited commitment → amount (i128 micro-USDC)
    Commitment(BytesN<32>),
    /// Spent nullifier hash → invoice_ref memo (String)
    Nullifier(BytesN<32>),
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
    pub memo: String,
}

// ── Errors ───────────────────────────────────────────────────────────────────
//
// #[contracterror] derives the trait impls needed to return Result<_, Error>
// from contract functions.

#[contracterror]
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
}
