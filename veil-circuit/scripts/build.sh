#!/usr/bin/env bash
# veil-circuit/scripts/build.sh
#
# Compiles the NoteSpend circuit, runs a Powers-of-Tau trusted setup (phase 1),
# performs circuit-specific setup (phase 2), and exports the Solidity-compatible
# verifying key and Soroban-compatible call-data format.
#
# Prerequisites:
#   npm install          (in veil-circuit/)
#   circom >= 2.1        (brew install circom  OR  cargo install circom)
#   node >= 18
#
# Output (written to veil-circuit/build/):
#   note_spend.r1cs          — constraint system
#   note_spend.wasm          — prover WASM
#   note_spend.sym           — debug symbols
#   pot12_final.ptau         — Powers of Tau (Hermez, 2^12 constraints)
#   note_spend_0000.zkey     — initial phase-2 key
#   note_spend_final.zkey    — final phase-2 key (after phase-2 contribution)
#   verification_key.json    — verifying key (for the Soroban contract init)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build"
CIRCUITS="$ROOT/circuits"

mkdir -p "$BUILD"

echo "==> [1/6] Compiling circuit..."
circom "$CIRCUITS/note_spend.circom" \
  --r1cs --wasm --sym \
  -l node_modules \
  --output "$BUILD"

echo "==> [2/6] Downloading Powers of Tau (Hermez ceremony, 2^12)..."
# Using the Hermez Phase 1 ceremony for BN254 (trusted, widely used)
if [ ! -f "$BUILD/pot12_final.ptau" ]; then
  curl -L \
    "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_12.ptau" \
    -o "$BUILD/pot12_final.ptau"
fi

echo "==> [3/6] Phase 2 setup (circuit-specific)..."
npx snarkjs groth16 setup \
  "$BUILD/note_spend.r1cs" \
  "$BUILD/pot12_final.ptau" \
  "$BUILD/note_spend_0000.zkey"

echo "==> [4/6] Phase 2 contribution (hackathon: entropy from /dev/urandom)..."
npx snarkjs zkey contribute \
  "$BUILD/note_spend_0000.zkey" \
  "$BUILD/note_spend_final.zkey" \
  --name="Veil Hackathon Contribution" \
  -e="$(head -c 32 /dev/urandom | base64)"

echo "==> [5/6] Exporting verification key..."
npx snarkjs zkey export verificationkey \
  "$BUILD/note_spend_final.zkey" \
  "$BUILD/verification_key.json"

echo "==> [6/6] Done!"
echo "    Circuit:          $BUILD/note_spend.wasm"
echo "    Final zkey:       $BUILD/note_spend_final.zkey"
echo "    Verification key: $BUILD/verification_key.json"
echo ""
echo "Next: run 'node scripts/generate_proof.js' to test a proof,"
echo "      or use the NestJS VeilService to generate proofs at runtime."
