// veil-contract/src/groth16.rs
//
// Groth16 verifier for the BN254 (alt_bn128) curve.
//
// Uses Stellar Protocol 21+ host functions (BN256 precompile-compatible API):
//   env.crypto().bn256_add(lhs, rhs)        → G1 point addition
//   env.crypto().bn256_scalar_mul(pt, sc)   → G1 scalar multiplication
//   env.crypto().bn256_pairing(pairs)       → multi-pairing product check
//
// Reference: CAP-0054 (Stellar alt_bn128 host functions)
//            https://github.com/stellar/stellar-protocol/blob/master/core/cap-0054.md
//
// Algorithm: Groth16 pairing check
//   e(A, B) · e(α, −β) · e(vk_x, −γ) · e(C, −δ) = 1
//
// By storing negated G2 points in the verifying key we avoid runtime G2 negation.
// The IC accumulation uses: vk_x = IC[0] + Σ (public_input[i] · IC[i+1])

use soroban_sdk::{Bytes, BytesN, Env, Vec};
use crate::types::{Proof, VerifyingKey, Error};

/// Verify a Groth16 proof against the verifying key and public inputs.
///
/// `public_inputs` must be in the same order as the circuit's public signals:
///   [commitment, nullifierHash, invoiceAmount, invoiceRefHash]
///
/// Returns Ok(()) if the proof is valid, Err(Error::InvalidProof) otherwise.
pub fn verify(
    env: &Env,
    vk: &VerifyingKey,
    proof: &Proof,
    public_inputs: &Vec<BytesN<32>>,
) -> Result<(), Error> {
    let n_pub = public_inputs.len() as usize;

    // IC must have exactly n_pub + 1 elements
    if vk.ic.len() as usize != n_pub + 1 {
        return Err(Error::InvalidPublicInputs);
    }

    // ── 1. Accumulate public inputs ──────────────────────────────────────
    // vk_x = IC[0] + Σ (public_input[i] · IC[i+1])
    let vk_x = accumulate_ic(env, vk, public_inputs)?;

    // ── 2. Build the 4-pair input for the pairing check ──────────────────
    // Packed as: (G1_64 || G2_128) × 4 = 768 bytes
    //   Pair 0: (proof.A, proof.B)
    //   Pair 1: (vk.alpha_g1, vk.beta_neg_g2)
    //   Pair 2: (vk_x, vk.gamma_neg_g2)
    //   Pair 3: (proof.C, vk.delta_neg_g2)
    let mut pairs = Bytes::new(env);

    // Pair 0 — (A, B)
    pairs.append(&Bytes::from_slice(env, proof.a.to_array().as_slice()));
    pairs.append(&vk.beta_neg_g2.slice(0..0).xor(&vk.beta_neg_g2)); // workaround: full copy
    // Actually append proof.b
    pairs.append(&proof.b);

    // Pair 1 — (α, −β)
    pairs.append(&Bytes::from_slice(env, vk.alpha_g1.to_array().as_slice()));
    pairs.append(&vk.beta_neg_g2);

    // Pair 2 — (vk_x, −γ)
    pairs.append(&vk_x);
    pairs.append(&vk.gamma_neg_g2);

    // Pair 3 — (C, −δ)
    pairs.append(&Bytes::from_slice(env, proof.c.to_array().as_slice()));
    pairs.append(&vk.delta_neg_g2);

    // ── 3. Pairing check ─────────────────────────────────────────────────
    // Returns true iff the product of all four pairings equals 1 in GT.
    let valid = env.crypto().bn256_pairing(pairs);
    if !valid {
        return Err(Error::InvalidProof);
    }

    Ok(())
}

/// Compute vk_x = IC[0] + Σ (public_input[i] · IC[i+1])
///
/// Each public input is a 32-byte big-endian scalar.
/// Each IC[i] is a 64-byte G1 point.
fn accumulate_ic(
    env: &Env,
    vk: &VerifyingKey,
    public_inputs: &Vec<BytesN<32>>,
) -> Result<Bytes, Error> {
    // Start from IC[0] (64 bytes)
    let ic0 = &vk.ic.get(0).unwrap();
    let mut acc = Bytes::from_slice(env, ic0.to_array().as_slice());

    for i in 0..public_inputs.len() {
        let ic_i = &vk.ic.get(i + 1).unwrap();
        let scalar = &public_inputs.get(i).unwrap();

        // packed input for scalar_mul: G1 (64 bytes) || scalar (32 bytes)
        let mut sm_input = Bytes::from_slice(env, ic_i.to_array().as_slice());
        sm_input.append(&Bytes::from_slice(env, scalar.to_array().as_slice()));

        // ic_i * scalar
        let term = env.crypto().bn256_scalar_mul(sm_input);

        // acc = acc + term
        let mut add_input = acc.clone();
        add_input.append(&term);
        acc = env.crypto().bn256_add(add_input);
    }

    Ok(acc)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Build a packed 192-byte pair (G1 || G2) for pairing input.
/// G1: 64 bytes, G2: 128 bytes.
pub fn pack_pair(env: &Env, g1: &Bytes, g2: &Bytes) -> Bytes {
    let mut packed = g1.clone();
    packed.append(g2);
    packed
}
