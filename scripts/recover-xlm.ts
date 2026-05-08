/**
 * recover-xlm.ts
 *
 * One-off recovery script: merges 25 orphaned Stellar accounts back to the
 * platform destination account via accountMerge.
 *
 * USAGE
 *   # Show plan only (safe — no chain activity, no DB writes):
 *   ts-node -r tsconfig-paths/register scripts/recover-xlm.ts
 *
 *   # Execute merges after reviewing the plan output:
 *   ts-node -r tsconfig-paths/register scripts/recover-xlm.ts --execute
 *
 * REQUIREMENTS
 *   SECRET_ENCRYPTION_KEY   64-hex-char AES-256-GCM key (same one the app uses)
 *   DATABASE_URL or DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME
 */

import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';

dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────

const DESTINATION  = 'GBOGVS7QHKU2HJUWIEKFOXJD5ZHXHI5OZJWX2Y4YKOK7PZ6NLBL3RO2G';
const HORIZON_URL  = 'https://horizon.stellar.org';
const NETWORK_PASS = StellarSdk.Networks.PUBLIC;
const DRY_RUN      = !process.argv.includes('--execute');

const ORPHANED_PUBLIC_KEYS = [
  'GCFCAKRU7YOTGTUB3BQROTA2L7KPHVIN4K5L7PEIZ4HIEZ2ZCEGVRJMA',
  'GAWDFG3JDNNUBJEN4CQPNVOSOVWQFJI5MHJ52JBPGD3QRJJ23V4ATRE3',
  'GCXKGK7HZ2LD3S4H3FFN5LZMO2A6XQBFDX6K3IEKUJJQ6MHKHONQJK7Y',
  'GA77UPOFKRS5HDYNMAD7KHJT6VCSNW7J3POFMQJ5YWWREHPRU2EXMPUC',
  'GDFCYZS4TNVWOBV6WUQ73PRXMHKOJM7KKMOERSG2AVCHE5RUZLYZ5BQK',
  'GBCCQTZYCIO4XDGABFJCSJJR6QQPUL7JH7O54ZCXWX7W67INIPAAPKPL',
  'GDOAL2F2GLMANTLXIIBPUA5ASIQ4GHN26JTEOYCRRUAE4EDKWPI3PMBZ',
  'GDPXMAX2VZU2Y7APHJJVTGPYQZSCPDWSTGPNVZ3ZSIMNJ37M7PUBDV57',
  'GDSHWGGVC26CC7SR4K7BIWTIIACHFATMPSZ3HTXBXTL5VBL4NLIMLOM6',
  'GDATX4EYDWSJBD4OCGTJ7Z5IVRKOFZ6FTSPFRTX7Q5WDNUKTQHRIDTOW',
  'GDZ47AUVFPYTWMEKNL34T6IV6A6P5U5245YAZBFLH7ZA3UXTWAHU3G3J',
  'GCDWHYG45GVJTLORTHXSBR7ZP7JUW6B3DFCYY4DQAXITSZP3OEGNCPQ2',
  'GDAVUU6KTNZLRDP46AWWMQWBMIIGJIKVHKW6BFQ4QFDLJOEZMJDSCIWD',
  'GCCBUPSKTFJHXZCX7XITBUDN2BS7B4BMNVZ3GOGT75KE7DPIES6NFEUP',
  'GDBC3WTQ3XGGI5YSPVYOBOBLJZPLNPOKGRPXOHAX4MP4IYAWHYLE7KN2',
  'GD3C3AXQDLYOWUJIHA5AOLMCKXNVGAIFUTMFOQF6LKGQP3NL3EECMRXL',
  'GC2T2DALILESKOOPXBDIXECJTVJHMPXULKJGJNCZZ7IMAZCHZA7PBA4E',
  'GAN3L2WXP3X6L2VO5EV27RJNNTY2QIVGLVHBA75EELSKDKJDLV2B63C5',
  'GBTWHEDCQOUMGNQ7XXWJWE6Y5EY6P5FJN5WHQMY4YWLZ2N22ZVVW4SXA',
  'GBPT3HQADTANJEJRCW7N5Y4R5CG4WWWDRFWQVIAIV5FBPM4YYSADROXJ',
  'GBQHKZA645EOVRLJ75RFKVM35R3VIKNYEIU32GEBISPZYVVMG477ADPU',
  'GBC2SUBYLVBHZMNHXCWM4JBQW735SSYGCSR5WBMOTNQIKTPKXPT5U5PX',
  'GB44GVLMPVF45BH2O7SEWQSKKM33D2CZZHET3MV3IJPARJNR2E375ZP2',
  'GBFPFAXUJZRRK2T5RXXGBDTYN7UUCN2DSCIDQPXR2U5ANZJFDEZEN2LO',
  'GAOQGIKJNQWIDUTDTNTIP5SKIOA5MLIOXD77GETYKLLGTW26XKHP3XIA',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decryptSecret(encryptedSecret: string, key: Buffer): string {
  const parts = encryptedSecret.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted secret format (expected iv:authTag:ciphertext)');
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv         = Buffer.from(ivHex, 'hex');
  const authTag    = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher   = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}

function buildDataSource(): DataSource {
  const url = process.env.DATABASE_URL;
  if (url) {
    return new DataSource({
      type: 'postgres',
      url,
      entities: [],
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      extra: { keepAlive: true },
    });
  }
  return new DataSource({
    type: 'postgres',
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    database: process.env.DB_NAME || 'cheese_pay',
    entities: [],
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
}

function log(status: 'MERGE' | 'SKIP' | 'OK' | 'FAIL' | 'INFO', key: string, detail: string) {
  const tag = status.padEnd(4);
  console.log(`  [${tag}]  ${key}  —  ${detail}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Validate encryption key
  const encKeyHex = process.env.SECRET_ENCRYPTION_KEY;
  if (!encKeyHex || encKeyHex.length !== 64) {
    console.error('ERROR: SECRET_ENCRYPTION_KEY must be set to exactly 64 hex characters.');
    process.exit(1);
  }
  const encryptionKey = Buffer.from(encKeyHex, 'hex');

  // 2. Connect to DB (read-only queries — no writes)
  const db = buildDataSource();
  await db.initialize();
  console.log('Connected to database.\n');

  const server = new StellarSdk.Horizon.Server(HORIZON_URL);

  // ── Phase 1: Build plan ────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  PHASE 1 — Cross-check DB and validate keys');
  console.log('═══════════════════════════════════════════════════════════\n');

  type MergeCandidate = { publicKey: string; secretKey: string };
  const toMerge: MergeCandidate[] = [];
  const skipped: { publicKey: string; reason: string }[] = [];

  for (const publicKey of ORPHANED_PUBLIC_KEYS) {
    // Raw query — avoids NestJS decorator/DI overhead, reads stellarSecretEnc directly
    const rows: Array<{
      id: string;
      email: string;
      is_active: boolean;
      stellar_wallet_status: string;
      stellar_secret_enc: string | null;
    }> = await db.query(
      `SELECT id, email, is_active, stellar_wallet_status, stellar_secret_enc
       FROM users
       WHERE stellar_public_key = $1
       LIMIT 1`,
      [publicKey],
    );

    // No DB record at all
    if (rows.length === 0) {
      skipped.push({ publicKey, reason: 'No DB record found for this public key' });
      log('SKIP', publicKey, 'No DB record found for this public key');
      continue;
    }

    const row = rows[0];

    // Belongs to an active user — do not touch
    if (row.is_active) {
      skipped.push({ publicKey, reason: `Active user (id: ${row.id}, email: ${row.email})` });
      log('SKIP', publicKey, `Active user — ${row.email} (${row.id})`);
      continue;
    }

    // Encrypted secret is missing
    if (!row.stellar_secret_enc) {
      skipped.push({ publicKey, reason: `User ${row.id} found but stellar_secret_enc is NULL` });
      log('SKIP', publicKey, `stellar_secret_enc is NULL (id: ${row.id})`);
      continue;
    }

    // Decrypt and validate
    let secretKey: string;
    try {
      secretKey = decryptSecret(row.stellar_secret_enc, encryptionKey);
    } catch (err: any) {
      skipped.push({ publicKey, reason: `Decryption failed: ${err.message}` });
      log('SKIP', publicKey, `Decryption error: ${err.message}`);
      continue;
    }

    // Sanity-check: derived public key must match
    let keypair: StellarSdk.Keypair;
    try {
      keypair = StellarSdk.Keypair.fromSecret(secretKey);
    } catch (err: any) {
      skipped.push({ publicKey, reason: `Invalid secret after decryption: ${err.message}` });
      log('SKIP', publicKey, `Invalid secret: ${err.message}`);
      continue;
    }

    if (keypair.publicKey() !== publicKey) {
      skipped.push({ publicKey, reason: 'Decrypted secret derives a DIFFERENT public key — data integrity error' });
      log('SKIP', publicKey, 'Public key mismatch after decryption — skipping for safety');
      continue;
    }

    toMerge.push({ publicKey, secretKey });
    log('MERGE', publicKey, `Queued (wallet_status: ${row.stellar_wallet_status})`);
  }

  console.log('\n─────────────────────────────────────────────────────────');
  console.log(`  Plan: ${toMerge.length} to merge, ${skipped.length} to skip`);
  console.log(`  Destination: ${DESTINATION}`);
  console.log('─────────────────────────────────────────────────────────\n');

  if (DRY_RUN) {
    console.log('  [DRY RUN] No merges submitted. Re-run with --execute to proceed.');
    await db.destroy();
    return;
  }

  // ── Phase 2: Execute merges ────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  PHASE 2 — Submitting accountMerge transactions');
  console.log('═══════════════════════════════════════════════════════════\n');

  let successCount = 0;
  let failCount    = 0;

  for (const { publicKey, secretKey } of toMerge) {
    // Check on-chain existence first
    let accountData: StellarSdk.Horizon.AccountResponse;
    try {
      accountData = await server.loadAccount(publicKey);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        log('SKIP', publicKey, 'Account not found on Horizon (already merged or never funded)');
        continue;
      }
      log('FAIL', publicKey, `Horizon loadAccount error: ${err?.message ?? String(err)}`);
      failCount++;
      continue;
    }

    // Build and submit accountMerge
    try {
      const keypair = StellarSdk.Keypair.fromSecret(secretKey);

      const tx = new StellarSdk.TransactionBuilder(accountData, {
        fee:              StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASS,
      })
        .addOperation(StellarSdk.Operation.accountMerge({ destination: DESTINATION }))
        .setTimeout(30)
        .build();

      tx.sign(keypair);

      const result = await server.submitTransaction(tx);
      log('OK', publicKey, `Merged — tx hash: ${result.hash}`);
      successCount++;
    } catch (err: any) {
      const codes = err?.response?.data?.extras?.result_codes;
      const detail = codes ? JSON.stringify(codes) : (err?.message ?? String(err));
      log('FAIL', publicKey, detail);
      failCount++;
    }
  }

  console.log('\n─────────────────────────────────────────────────────────');
  console.log(`  Done: ${successCount} merged successfully, ${failCount} failed`);
  console.log('─────────────────────────────────────────────────────────\n');

  await db.destroy();
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
