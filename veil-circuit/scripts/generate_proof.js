/**
 * veil-circuit/scripts/generate_proof.js
 *
 * Standalone script to generate and verify a NoteSpend proof.
 * Used for local testing before deploying the Soroban contract.
 *
 * Usage:  node scripts/generate_proof.js
 *
 * Dependencies: npm install  (in veil-circuit/)
 * Circuit must be compiled first: bash scripts/build.sh
 */

'use strict';

const path = require('path');
const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');

const BUILD = path.join(__dirname, '../build');

async function main() {
  const poseidon = await buildPoseidon();

  // ── Generate a random note ──────────────────────────────────────────────
  const secret   = BigInt('0x' + require('crypto').randomBytes(31).toString('hex'));
  const nullifier = BigInt('0x' + require('crypto').randomBytes(31).toString('hex'));
  const amount    = BigInt(10_000_000); // 10.000000 USDC (6 decimals)

  // Commitment = Poseidon(secret, nullifier, amount)
  const commitment    = poseidon.F.toObject(poseidon([secret, nullifier, amount]));
  const nullifierHash = poseidon.F.toObject(poseidon([nullifier]));

  // Invoice parameters
  const invoiceAmount  = BigInt(5_000_000);  // 5.000000 USDC minimum
  const invoiceRef     = 'PI-A1B2C3D4E5F6G7H8';
  const invoiceRefHash = poseidon.F.toObject(
    poseidon([BigInt('0x' + Buffer.from(invoiceRef).toString('hex'))]),
  );

  console.log('Note:', { secret: secret.toString(), nullifier: nullifier.toString(), amount: amount.toString() });
  console.log('Commitment:    ', commitment.toString());
  console.log('NullifierHash: ', nullifierHash.toString());
  console.log('InvoiceRefHash:', invoiceRefHash.toString());

  // ── Generate Groth16 proof ───────────────────────────────────────────────
  console.log('\nGenerating proof...');
  const input = {
    // Private
    secret:      secret.toString(),
    nullifier:   nullifier.toString(),
    amount:      amount.toString(),
    // Public
    commitment:     commitment.toString(),
    nullifierHash:  nullifierHash.toString(),
    invoiceAmount:  invoiceAmount.toString(),
    invoiceRefHash: invoiceRefHash.toString(),
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    path.join(BUILD, 'note_spend_js', 'note_spend.wasm'),
    path.join(BUILD, 'note_spend_final.zkey'),
  );

  console.log('\nProof:', JSON.stringify(proof, null, 2));
  console.log('\nPublic signals:', publicSignals);

  // ── Verify locally ───────────────────────────────────────────────────────
  const vKey = require(path.join(BUILD, 'verification_key.json'));
  const valid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  console.log('\nProof valid (local):', valid);

  // ── Export Soroban call-data format ─────────────────────────────────────
  // The Soroban contract expects proof as raw bytes:
  //   proof.A  : 64 bytes  (G1 point: x_32 || y_32, big-endian)
  //   proof.B  : 128 bytes (G2 point: x1_32 || x0_32 || y1_32 || y0_32, big-endian)
  //   proof.C  : 64 bytes  (G1 point: x_32 || y_32, big-endian)
  // All field elements are 0-padded to 32 bytes, big-endian.

  const toHex32 = (n) => BigInt(n).toString(16).padStart(64, '0');

  const proofBytes =
    toHex32(proof.pi_a[0]) + toHex32(proof.pi_a[1]) +           // A (64 bytes)
    toHex32(proof.pi_b[0][1]) + toHex32(proof.pi_b[0][0]) +    // B x (32+32)
    toHex32(proof.pi_b[1][1]) + toHex32(proof.pi_b[1][0]) +    // B y (32+32)
    toHex32(proof.pi_c[0]) + toHex32(proof.pi_c[1]);            // C (64 bytes)

  const pubInputBytes = publicSignals
    .map((s) => toHex32(BigInt(s)))
    .join('');

  console.log('\nSoroban proof bytes (hex, 256 bytes total):');
  console.log(proofBytes);
  console.log('\nPublic inputs bytes (hex):');
  console.log(pubInputBytes);

  process.exit(valid ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
