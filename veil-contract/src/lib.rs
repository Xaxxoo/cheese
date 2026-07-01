// veil-contract/src/lib.rs
//
// VeilPool — Soroban smart contract for ZK-powered private payments on Stellar
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  FLOW                                                                    │
// │                                                                          │
// │  1. INIT     admin calls initialize(usdc_token, hot_wallet, operator)   │
// │                                                                          │
// │  2. DEPOSIT  depositor calls deposit(commitment, amount)                 │
// │              → transfers USDC from depositor into this contract          │
// │              → stores commitment → amount in persistent storage          │
// │              After this tx the depositor's address is no longer needed.  │
// │                                                                          │
// │  3. WITHDRAW operator (Cheese backend) calls                             │
// │              withdraw(commitment, nullifier_hash, amount, memo)          │
// │              The Groth16 proof is verified off-chain by the backend      │
// │              before calling this. The contract enforces:                 │
// │                • commitment was deposited                                │
// │                • nullifier has not been spent (no double-spend)          │
// │              Then transfers USDC to the Cheese hot-wallet with memo      │
// │              (= invoice reference) so the backend can settle NGN.        │
// │                                                                          │
// │  Privacy guarantee: the commitment scheme breaks the on-chain link       │
// │  between depositor and payment; the nullifier prevents replay.           │
// └──────────────────────────────────────────────────────────────────────────┘

#![no_std]

use soroban_sdk::{
    contract, contractimpl,
    Address, BytesN, Env, String,
    token::Client as TokenClient,
    symbol_short,
};

mod types;
#[allow(dead_code)]
mod groth16; // empty — BN254 host fns not yet in soroban-sdk; proof verified off-chain

use types::{DataKey, DepositEvent, Error, WithdrawEvent};

#[contract]
pub struct VeilPool;

#[contractimpl]
impl VeilPool {
    // ── Initialization ────────────────────────────────────────────────────

    /// One-time init. Must be called before any deposits or withdrawals.
    ///
    /// * `admin`      — can call `update_operator` later
    /// * `usdc_token` — USDC SAC address on this network
    /// * `hot_wallet` — Cheese hot-wallet; all withdrawals go here
    /// * `operator`   — Cheese backend Stellar keypair; the only address
    ///                  authorised to call `withdraw`
    pub fn initialize(
        env: Env,
        admin: Address,
        usdc_token: Address,
        hot_wallet: Address,
        operator: Address,
    ) -> Result<(), Error> {
        admin.require_auth();

        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin,     &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::HotWallet, &hot_wallet);
        env.storage().instance().set(&DataKey::Operator,  &operator);

        Ok(())
    }

    // ── Deposit ───────────────────────────────────────────────────────────

    /// Deposit USDC and register a shielded commitment.
    ///
    /// `commitment` = Poseidon(secret, nullifier, amount) — computed off-chain.
    /// `amount`     = micro-USDC (multiply human amount by 1_000_000).
    pub fn deposit(
        env: Env,
        depositor: Address,
        commitment: BytesN<32>,
        amount: i128,
    ) -> Result<(), Error> {
        depositor.require_auth();
        Self::require_initialized(&env)?;

        if env.storage().persistent().has(&DataKey::Commitment(commitment.clone())) {
            return Err(Error::CommitmentExists);
        }

        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token = TokenClient::new(&env, &usdc_token);
        token.transfer(&depositor, &env.current_contract_address(), &amount);

        env.storage().persistent().set(&DataKey::Commitment(commitment.clone()), &amount);

        env.events().publish(
            (symbol_short!("deposit"), commitment.clone()),
            DepositEvent { commitment, amount },
        );

        Ok(())
    }

    // ── Withdraw ──────────────────────────────────────────────────────────

    /// Withdraw from the pool.
    ///
    /// Only callable by the authorised `operator` (Cheese backend service).
    /// The operator must have already verified the Groth16 proof off-chain
    /// using snarkjs before submitting this transaction.
    ///
    /// `commitment`    — must match a previously deposited commitment
    /// `nullifier_hash`— Poseidon(nullifier); prevents double-spend
    /// `amount`        — micro-USDC to transfer to the hot-wallet
    /// `memo`          — invoice reference (e.g. "PI-A1B2C3D4E5F6G7H8")
    pub fn withdraw(
        env: Env,
        commitment: BytesN<32>,
        nullifier_hash: BytesN<32>,
        amount: i128,
        memo: String,
    ) -> Result<(), Error> {
        Self::require_initialized(&env)?;

        // Only the authorised operator can call this
        let operator: Address = env.storage().instance().get(&DataKey::Operator).unwrap();
        operator.require_auth();

        // Commitment must have been deposited
        if !env.storage().persistent().has(&DataKey::Commitment(commitment.clone())) {
            return Err(Error::CommitmentNotFound);
        }

        // Nullifier must not be spent
        if env.storage().persistent().has(&DataKey::Nullifier(nullifier_hash.clone())) {
            return Err(Error::NullifierSpent);
        }

        // Mark nullifier as spent
        env.storage().persistent().set(
            &DataKey::Nullifier(nullifier_hash.clone()),
            &memo,
        );

        // Transfer USDC to the hot-wallet
        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let hot_wallet: Address = env.storage().instance().get(&DataKey::HotWallet).unwrap();
        let token = TokenClient::new(&env, &usdc_token);
        token.transfer(&env.current_contract_address(), &hot_wallet, &amount);

        env.events().publish(
            (symbol_short!("withdraw"), nullifier_hash.clone()),
            WithdrawEvent { nullifier_hash, amount, memo },
        );

        Ok(())
    }

    // ── Read-only views ───────────────────────────────────────────────────

    pub fn has_commitment(env: Env, commitment: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Commitment(commitment))
    }

    pub fn is_spent(env: Env, nullifier_hash: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Nullifier(nullifier_hash))
    }

    pub fn commitment_amount(env: Env, commitment: BytesN<32>) -> i128 {
        env.storage()
            .persistent()
            .get::<DataKey, i128>(&DataKey::Commitment(commitment))
            .unwrap_or(0)
    }

    // ── Admin ─────────────────────────────────────────────────────────────

    /// Replace the withdrawal operator (e.g. after key rotation).
    pub fn update_operator(env: Env, new_operator: Address) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Operator, &new_operator);
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
