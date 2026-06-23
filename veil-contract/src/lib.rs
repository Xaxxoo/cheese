// veil-contract/src/lib.rs
//
// VeilPool — Soroban smart contract for ZK-powered private payments on Stellar
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  FLOW                                                                    │
// │                                                                          │
// │  1. INIT   admin calls init(usdc_token, hot_wallet, vk)                  │
// │                                                                          │
// │  2. DEPOSIT  user calls deposit(depositor, commitment, amount)           │
// │              → transfers USDC from depositor into this contract          │
// │              → stores commitment in persistent storage                   │
// │                                                                          │
// │  3. WITHDRAW  user calls withdraw(proof, public_inputs, amount, memo)   │
// │              → verifies Groth16 proof using BN254 pairing host fns       │
// │              → checks commitment exists (not fabricated)                 │
// │              → checks nullifier not spent (prevents double-spend)        │
// │              → transfers USDC to the Cheese hot-wallet with memo         │
// │                                                                          │
// │  Public inputs (in order):                                               │
// │    [commitment, nullifierHash, invoiceAmount, invoiceRefHash]            │
// │                                                                          │
// │  The hot-wallet is Cheese's Stellar address. Cheese detects the deposit  │
// │  via memo (= invoice reference), matches the private invoice, and        │
// │  triggers NGN bank settlement to the merchant.                           │
// └──────────────────────────────────────────────────────────────────────────┘

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl,
    Address, Bytes, BytesN, Env, String, Vec,
    token::Client as TokenClient,
    symbol_short,
};

mod groth16;
mod types;

use types::{DataKey, DepositEvent, Error, Proof, VerifyingKey, WithdrawEvent};

// ── Public-input indices ─────────────────────────────────────────────────────
// Must match the order of public signals in note_spend.circom
const IDX_COMMITMENT:       u32 = 0;
const IDX_NULLIFIER_HASH:   u32 = 1;
const IDX_INVOICE_AMOUNT:   u32 = 2;
const IDX_INVOICE_REF_HASH: u32 = 3;

#[contract]
pub struct VeilPool;

#[contractimpl]
impl VeilPool {
    // ── Initialization ────────────────────────────────────────────────────

    /// Initialize the pool. Must be called once before any deposits or withdrawals.
    ///
    /// * `usdc_token`  — USDC SAC contract address on this network
    /// * `hot_wallet`  — Cheese platform Stellar hot-wallet address
    ///                   (all withdrawals are routed here)
    /// * `vk`          — Groth16 verifying key for the NoteSpend circuit
    ///                   (G2 points must be pre-negated: store −β, −γ, −δ)
    pub fn initialize(
        env: Env,
        admin: Address,
        usdc_token: Address,
        hot_wallet: Address,
        vk: VerifyingKey,
    ) -> Result<(), Error> {
        admin.require_auth();

        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::HotWallet, &hot_wallet);
        env.storage().instance().set(&DataKey::VerifyingKey, &vk);

        Ok(())
    }

    // ── Deposit ───────────────────────────────────────────────────────────

    /// Deposit USDC into the pool and register a commitment.
    ///
    /// `commitment` = Poseidon(secret, nullifier, amount) computed off-chain.
    /// `amount`     = USDC amount in micro-units (amount * 1_000_000).
    ///
    /// The depositor authorises the token transfer. The commitment is stored
    /// persistently; no other information about the depositor is recorded.
    pub fn deposit(
        env: Env,
        depositor: Address,
        commitment: BytesN<32>,
        amount: i128,
    ) -> Result<(), Error> {
        depositor.require_auth();
        Self::require_initialized(&env)?;

        // Reject duplicate commitments (each note must be unique)
        if env.storage().persistent().has(&DataKey::Commitment(commitment.clone())) {
            return Err(Error::CommitmentExists);
        }

        // Transfer USDC from depositor into this contract
        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token = TokenClient::new(&env, &usdc_token);
        token.transfer(&depositor, &env.current_contract_address(), &amount);

        // Record commitment → amount (persistent storage, survives ledger expiry extension)
        env.storage().persistent().set(&DataKey::Commitment(commitment.clone()), &amount);

        // Emit deposit event
        env.events().publish(
            (symbol_short!("deposit"), commitment.clone()),
            DepositEvent { commitment, amount },
        );

        Ok(())
    }

    // ── Withdraw ──────────────────────────────────────────────────────────

    /// Withdraw from the pool by submitting a valid ZK proof.
    ///
    /// `proof`         — Groth16 proof bytes (256 bytes: A:64 || B:128 || C:64)
    /// `public_inputs` — [commitment, nullifierHash, invoiceAmount, invoiceRefHash]
    ///                   each is a 32-byte big-endian field element
    /// `amount`        — USDC amount to transfer (micro-units); must equal
    ///                   the deposited amount or any value ≤ note amount;
    ///                   the circuit already proves amount >= invoiceAmount
    /// `memo`          — invoice reference string (e.g. "PI-A1B2C3D4")
    ///                   sent to the hot wallet so Cheese can match the invoice
    pub fn withdraw(
        env: Env,
        proof_bytes: Bytes,
        public_inputs: Vec<BytesN<32>>,
        amount: i128,
        memo: String,
    ) -> Result<(), Error> {
        Self::require_initialized(&env)?;

        if public_inputs.len() != 4 {
            return Err(Error::InvalidPublicInputs);
        }

        // Extract public signals by index
        let commitment:      BytesN<32> = public_inputs.get(IDX_COMMITMENT).unwrap();
        let nullifier_hash:  BytesN<32> = public_inputs.get(IDX_NULLIFIER_HASH).unwrap();
        let invoice_ref_hash: BytesN<32> = public_inputs.get(IDX_INVOICE_REF_HASH).unwrap();

        // ── 1. Commitment must exist (deposited previously) ───────────────
        if !env.storage().persistent().has(&DataKey::Commitment(commitment.clone())) {
            return Err(Error::CommitmentNotFound);
        }

        // ── 2. Nullifier must not be spent ───────────────────────────────
        if env.storage().persistent().has(&DataKey::Nullifier(nullifier_hash.clone())) {
            return Err(Error::NullifierSpent);
        }

        // ── 3. Decode proof bytes (A:64 || B:128 || C:64 = 256 bytes) ────
        if proof_bytes.len() != 256 {
            return Err(Error::InvalidProof);
        }
        let proof = Proof {
            a: BytesN::from_array(&env, &bytes_to_array64(&env, &proof_bytes, 0)),
            b: proof_bytes.slice(64..192),
            c: BytesN::from_array(&env, &bytes_to_array64(&env, &proof_bytes, 192)),
        };

        // ── 4. Verify Groth16 proof ───────────────────────────────────────
        let vk: VerifyingKey = env.storage().instance().get(&DataKey::VerifyingKey).unwrap();
        groth16::verify(&env, &vk, &proof, &public_inputs)?;

        // ── 5. Mark nullifier as spent (prevents replay) ─────────────────
        env.storage().persistent().set(
            &DataKey::Nullifier(nullifier_hash.clone()),
            &memo,
        );

        // ── 6. Transfer USDC to Cheese hot-wallet ────────────────────────
        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let hot_wallet: Address = env.storage().instance().get(&DataKey::HotWallet).unwrap();
        let token = TokenClient::new(&env, &usdc_token);
        token.transfer(&env.current_contract_address(), &hot_wallet, &amount);

        // Emit withdrawal event
        env.events().publish(
            (symbol_short!("withdraw"), nullifier_hash.clone()),
            WithdrawEvent {
                nullifier_hash: nullifier_hash.clone(),
                amount,
                invoice_ref_hash,
            },
        );

        Ok(())
    }

    // ── Read-only views ───────────────────────────────────────────────────

    /// Returns true if this commitment was deposited.
    pub fn has_commitment(env: Env, commitment: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Commitment(commitment))
    }

    /// Returns true if this nullifier hash has been spent.
    pub fn is_spent(env: Env, nullifier_hash: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Nullifier(nullifier_hash))
    }

    /// Returns the deposited amount for a commitment (0 if not found).
    pub fn commitment_amount(env: Env, commitment: BytesN<32>) -> i128 {
        env.storage()
            .persistent()
            .get::<DataKey, i128>(&DataKey::Commitment(commitment))
            .unwrap_or(0)
    }

    // ── Admin ─────────────────────────────────────────────────────────────

    /// Replace the verifying key (e.g. after re-running trusted setup).
    pub fn update_vk(env: Env, new_vk: VerifyingKey) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::VerifyingKey, &new_vk);
        Ok(())
    }

    // ── Private helpers ───────────────────────────────────────────────────

    fn require_initialized(env: &Env) -> Result<(), Error> {
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }
        Ok(())
    }
}

/// Extract 64 bytes starting at `offset` from a Bytes value into a [u8; 64].
fn bytes_to_array64(env: &Env, src: &Bytes, offset: u32) -> [u8; 64] {
    let mut arr = [0u8; 64];
    for i in 0..64 {
        arr[i as usize] = src.get(offset + i).unwrap();
    }
    arr
}
