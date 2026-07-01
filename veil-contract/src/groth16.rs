// veil-contract/src/groth16.rs
//
// Groth16 BN254 verification is performed off-chain by the NestJS VeilService
// using snarkjs before the operator calls VeilPool::withdraw on-chain.
//
// This file is intentionally empty — kept to document the design decision.
// On-chain BN254 pairing host functions (bn256_add, bn256_scalar_mul,
// bn256_pairing) are not available in soroban-sdk 22.x; they are planned
// for a future protocol upgrade (CAP-0067). Once available the verifier
// can be moved on-chain without changing the contract interface.
