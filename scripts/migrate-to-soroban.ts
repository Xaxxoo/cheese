/**
 * migrate-to-soroban.ts
 *
 * Migrates all existing user USDC balances from individual classic Stellar
 * wallets into the CheesePay Soroban contract so that the contract-based
 * send/transfer path works correctly.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  PHASE 1  Register every active user in the contract (register_user)     │
 * │  PHASE 2  Sweep each user's USDC from their classic wallet to the        │
 * │           contract address via the USDC Stellar Asset Contract           │
 * │  PHASE 3  Credit each user's internal balance (deposit_by_address)       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE
 *   # Dry run — shows what WOULD happen, no chain activity:
 *   ts-node -r tsconfig-paths/register scripts/migrate-to-soroban.ts
 *
 *   # Execute (irreversible — test on testnet first):
 *   ts-node -r tsconfig-paths/register scripts/migrate-to-soroban.ts --execute
 *
 * REQUIRED ENV
 *   SECRET_ENCRYPTION_KEY        64-hex AES-256-GCM key (same as app)
 *   STELLAR_PLATFORM_SECRET_KEY  Platform/admin keypair secret (S...)
 *   STELLAR_HORIZON_URL          e.g. https://horizon.stellar.org
 *   STELLAR_SOROBAN_RPC_URL      e.g. https://soroban-rpc.stellar.org
 *   STELLAR_CONTRACT_ID          CheesePay contract address (C...)
 *   DATABASE_URL  OR  DB_HOST + DB_PORT + DB_USER + DB_PASS + DB_NAME
 */

import * as crypto  from 'crypto';
import * as dotenv  from 'dotenv';
import { DataSource } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';

dotenv.config();

// ─── Constants ────────────────────────────────────────────────────────────────

const DRY_RUN          = !process.argv.includes('--execute');
const BATCH_MAX        = 50;   // contract's BATCH_MAX_SIZE
const POLL_MS          = 2000;
const POLL_ATTEMPTS    = 60;
const SOROBAN_FEE      = '500000'; // 0.05 XLM — competitive inclusion fee on mainnet
const NOT_FOUND_STATUS = StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND;
const SUCCESS_STATUS   = StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS;

const USDC_ISSUERS: Record<string, string> = {
  [StellarSdk.Networks.PUBLIC]:  'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  [StellarSdk.Networks.TESTNET]: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id:                 string;
  username:           string;
  stellar_public_key: string;
  stellar_secret_enc: string;
}

interface SweepRecord {
  user:   UserRow;
  amount: string;   // human-readable USDC
  txHash: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decryptSecret(enc: string, key: Buffer): string {
  const [ivHex, authTagHex, ciphertextHex] = enc.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex)
    throw new Error('Invalid encrypted secret format (expected iv:authTag:ciphertext)');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return (
    decipher.update(Buffer.from(ciphertextHex, 'hex')).toString('utf8') +
    decipher.final('utf8')
  );
}

function buildDataSource(): DataSource {
  const url = process.env.DATABASE_URL;
  const sslConfig = process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false;

  if (url) {
    return new DataSource({ type: 'postgres', url, entities: [], ssl: sslConfig });
  }
  return new DataSource({
    type:     'postgres',
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASS     || 'postgres',
    database: process.env.DB_NAME     || 'cheese_pay',
    entities: [],
    ssl:      sslConfig,
  });
}

function log(
  tag:    'INFO' | 'PLAN' | 'OK  ' | 'SKIP' | 'FAIL' | 'WARN',
  label:  string,
  detail: string,
) {
  console.log(`  [${tag}]  ${label.padEnd(56)}  ${detail}`);
}

function stroopsToUsdc(stroops: bigint): string {
  return (Number(stroops) / 10_000_000).toFixed(7);
}

function usdcToStroops(usdc: string): bigint {
  return BigInt(Math.round(parseFloat(usdc) * 10_000_000));
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Submit a prepared + signed Soroban transaction and poll until it lands.
 * Returns the transaction hash on success, throws on failure.
 */
async function submitAndPoll(
  sorobanRpc: StellarSdk.rpc.Server,
  tx:         StellarSdk.Transaction,
): Promise<string> {
  const sendResult = await sorobanRpc.sendTransaction(tx);

  if (sendResult.status === 'ERROR') {
    const errDetail = sendResult.errorResult
      ? (sendResult.errorResult as any).toXDR('base64') as string
      : 'unknown';
    throw new Error(`Submit error: ${errDetail}`);
  }

  let result = await sorobanRpc.getTransaction(sendResult.hash);
  let attempts = 0;

  while (result.status === NOT_FOUND_STATUS && attempts < POLL_ATTEMPTS) {
    await sleep(POLL_MS);
    result = await sorobanRpc.getTransaction(sendResult.hash);
    attempts++;
  }

  if (result.status !== SUCCESS_STATUS) {
    throw new Error(
      `Transaction did not confirm after ${attempts} attempts — status: ${result.status}`,
    );
  }

  return sendResult.hash;
}

/**
 * Build, simulate, assemble, sign and optionally submit a platform-signed
 * Soroban transaction.  Returns the tx hash (or '[dry-run]' if DRY_RUN).
 */
async function platformSorobanTx(
  sorobanRpc:      StellarSdk.rpc.Server,
  networkPass:     string,
  platformKeypair: StellarSdk.Keypair,
  operation:       StellarSdk.xdr.Operation,
): Promise<string> {
  const platformAcct = await sorobanRpc.getAccount(platformKeypair.publicKey());

  const rawTx = new StellarSdk.TransactionBuilder(platformAcct, {
    fee:              SOROBAN_FEE,
    networkPassphrase: networkPass,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();

  const sim = await sorobanRpc.simulateTransaction(rawTx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }

  if (DRY_RUN) return '[dry-run]';

  const prepared = StellarSdk.rpc
    .assembleTransaction(
      rawTx,
      sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse,
    )
    .build();

  prepared.sign(platformKeypair);
  return submitAndPoll(sorobanRpc, prepared);
}

/**
 * Sweep USDC from a user's classic Stellar wallet to the contract address
 * via the USDC Stellar Asset Contract (SAC) transfer function.
 * The user's own keypair signs this transaction.
 */
async function sweepUserUsdc(opts: {
  sorobanRpc:   StellarSdk.rpc.Server;
  networkPass:  string;
  usdcSacId:    string;
  contractId:   string;
  userKeypair:  StellarSdk.Keypair;
  amountStroops: bigint;
}): Promise<string> {
  const { sorobanRpc, networkPass, usdcSacId, contractId, userKeypair, amountStroops } = opts;
  const userPublicKey = userKeypair.publicKey();

  const userAcct = await sorobanRpc.getAccount(userPublicKey);
  const sacContract = new StellarSdk.Contract(usdcSacId);

  const rawTx = new StellarSdk.TransactionBuilder(userAcct, {
    fee:               SOROBAN_FEE,
    networkPassphrase: networkPass,
  })
    .addOperation(
      sacContract.call(
        'transfer',
        StellarSdk.nativeToScVal(userPublicKey, { type: 'address' }),
        StellarSdk.nativeToScVal(contractId,    { type: 'address' }),
        StellarSdk.nativeToScVal(amountStroops, { type: 'i128'    }),
      ),
    )
    .setTimeout(300)
    .build();

  const sim = await sorobanRpc.simulateTransaction(rawTx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }

  if (DRY_RUN) return '[dry-run]';

  const prepared = StellarSdk.rpc
    .assembleTransaction(
      rawTx,
      sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse,
    )
    .build();

  prepared.sign(userKeypair);
  return submitAndPoll(sorobanRpc, prepared);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── Validate env ────────────────────────────────────────────────────────────

  const encKeyHex         = process.env.SECRET_ENCRYPTION_KEY;
  const platformSecretKey = process.env.STELLAR_PLATFORM_SECRET_KEY;
  const horizonUrl        = process.env.STELLAR_HORIZON_URL;
  const sorobanRpcUrl     = process.env.STELLAR_SOROBAN_RPC_URL;
  const contractId        = process.env.STELLAR_CONTRACT_ID;

  const missing: string[] = [];
  if (!encKeyHex || encKeyHex.length !== 64) missing.push('SECRET_ENCRYPTION_KEY (must be 64 hex chars)');
  if (!platformSecretKey)                    missing.push('STELLAR_PLATFORM_SECRET_KEY');
  if (!horizonUrl)                           missing.push('STELLAR_HORIZON_URL');
  if (!sorobanRpcUrl)                        missing.push('STELLAR_SOROBAN_RPC_URL');
  if (!contractId)                           missing.push('STELLAR_CONTRACT_ID');

  // If STELLAR_CONTRACT_ID is absent the migration is intentionally disabled
  // (e.g. during the classic-fallback window).  Exit 0 so start:prod continues.
  if (!contractId) {
    console.log('[migrate-to-soroban] STELLAR_CONTRACT_ID not set — skipping migration.');
    process.exit(0);
  }

  if (missing.length > 0) {
    console.error('Missing required environment variables:\n  ' + missing.join('\n  '));
    process.exit(1);
  }

  const encryptionKey     = Buffer.from(encKeyHex!, 'hex');
  const platformKeypair   = StellarSdk.Keypair.fromSecret(platformSecretKey!);
  const horizon           = new StellarSdk.Horizon.Server(horizonUrl!);
  const sorobanRpc        = new StellarSdk.rpc.Server(sorobanRpcUrl!);
  const contract          = new StellarSdk.Contract(contractId!);

  // Determine network passphrase from Horizon URL
  const networkPass = horizonUrl!.includes('testnet')
    ? StellarSdk.Networks.TESTNET
    : StellarSdk.Networks.PUBLIC;

  const usdcIssuer  = USDC_ISSUERS[networkPass];
  const usdcAsset   = new StellarSdk.Asset('USDC', usdcIssuer);
  const usdcSacId   = usdcAsset.contractId(networkPass);

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  CheesePay → Soroban migration script');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  Mode:        ${DRY_RUN ? 'DRY RUN (pass --execute to submit)' : '⚠️  EXECUTE — transactions WILL be submitted'}`);
  console.log(`  Network:     ${networkPass === StellarSdk.Networks.PUBLIC ? 'MAINNET' : 'TESTNET'}`);
  console.log(`  Contract:    ${contractId}`);
  console.log(`  USDC SAC:    ${usdcSacId}`);
  console.log(`  Platform:    ${platformKeypair.publicKey()}`);
  console.log('══════════════════════════════════════════════════════════\n');

  // ── Connect to DB ────────────────────────────────────────────────────────────

  const db = buildDataSource();
  await db.initialize();
  console.log('  Connected to database.\n');

  // Load every active user that has a Stellar wallet
  const users: UserRow[] = await db.query(`
    SELECT id, username, stellar_public_key, stellar_secret_enc
    FROM   users
    WHERE  stellar_public_key IS NOT NULL
      AND  stellar_secret_enc IS NOT NULL
      AND  username           IS NOT NULL
      AND  is_active          = true
    ORDER BY created_at ASC
  `);

  console.log(`  Found ${users.length} users with Stellar wallets.\n`);

  // ── Validate all secrets up-front ────────────────────────────────────────────

  console.log('══════════════════════════════════════════════════════════');
  console.log('  PRE-FLIGHT — Decrypting and validating all user secrets');
  console.log('══════════════════════════════════════════════════════════\n');

  const validUsers: Array<UserRow & { keypair: StellarSdk.Keypair }> = [];

  for (const user of users) {
    let secretKey: string;
    try {
      secretKey = decryptSecret(user.stellar_secret_enc, encryptionKey);
    } catch (err: any) {
      log('SKIP', user.username, `Decryption failed: ${err.message as string}`);
      continue;
    }

    let keypair: StellarSdk.Keypair;
    try {
      keypair = StellarSdk.Keypair.fromSecret(secretKey);
    } catch (err: any) {
      log('SKIP', user.username, `Invalid secret key: ${err.message as string}`);
      continue;
    }

    if (keypair.publicKey() !== user.stellar_public_key) {
      log('SKIP', user.username, 'Public key mismatch after decryption — skipping for safety');
      continue;
    }

    validUsers.push({ ...user, keypair });
  }

  console.log(`\n  ${validUsers.length} / ${users.length} users passed pre-flight.\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 1 — Register users in the contract
  // Uses batch_register_users (up to 50 per transaction) for efficiency.
  // Users already registered are skipped gracefully.
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('══════════════════════════════════════════════════════════');
  console.log('  PHASE 1 — Register users in contract');
  console.log('══════════════════════════════════════════════════════════\n');

  let reg_ok   = 0;
  let reg_skip = 0;
  let reg_fail = 0;

  // Split into batches of BATCH_MAX
  for (let i = 0; i < validUsers.length; i += BATCH_MAX) {
    const batch = validUsers.slice(i, i + BATCH_MAX);

    const usernames  = batch.map(u => u.username);
    const addresses  = batch.map(u => u.stellar_public_key);
    const batchLabel = `batch ${Math.floor(i / BATCH_MAX) + 1} (users ${i + 1}–${Math.min(i + BATCH_MAX, validUsers.length)})`;

    try {
      const op = contract.call(
        'batch_register_users',
        StellarSdk.nativeToScVal(
          usernames.map(u => StellarSdk.nativeToScVal(u, { type: 'string' })),
        ),
        StellarSdk.nativeToScVal(
          addresses.map(a => StellarSdk.nativeToScVal(a, { type: 'address' })),
        ),
      );

      const txHash = await platformSorobanTx(sorobanRpc, networkPass, platformKeypair, op);
      log('OK  ', batchLabel, `Registered ${batch.length} users — tx: ${txHash}`);
      reg_ok += batch.length;
    } catch (err: any) {
      const msg = err.message as string;

      // If some users in the batch are already registered the whole batch fails.
      // Fall back to registering each user individually so others go through.
      if (msg.includes('UsernameTaken') || msg.includes('UserAlreadyRegistered')) {
        log('WARN', batchLabel, 'Batch had already-registered users — retrying individually');

        for (const user of batch) {
          try {
            const op = contract.call(
              'register_user',
              StellarSdk.nativeToScVal(user.username,           { type: 'string'  }),
              StellarSdk.nativeToScVal(user.stellar_public_key, { type: 'address' }),
            );
            const txHash = await platformSorobanTx(sorobanRpc, networkPass, platformKeypair, op);
            log('OK  ', user.username, `Registered — tx: ${txHash}`);
            reg_ok++;
          } catch (innerErr: any) {
            const innerMsg = innerErr.message as string;
            if (innerMsg.includes('UsernameTaken') || innerMsg.includes('UserAlreadyRegistered')) {
              log('SKIP', user.username, 'Already registered in contract');
              reg_skip++;
            } else {
              log('FAIL', user.username, `register_user failed: ${innerMsg}`);
              reg_fail++;
            }
          }
        }
      } else {
        log('FAIL', batchLabel, `batch_register_users failed: ${msg}`);
        reg_fail += batch.length;
      }
    }
  }

  console.log(`\n  Phase 1 complete: ${reg_ok} registered, ${reg_skip} already existed, ${reg_fail} failed.\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 2 — Sweep USDC from each user's classic wallet to the contract
  // Reads the user's classic Stellar USDC trustline balance, then calls
  // usdc_sac.transfer(user → contract, amount) signed by the user's keypair.
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('══════════════════════════════════════════════════════════');
  console.log('  PHASE 2 — Sweep USDC to contract');
  console.log('══════════════════════════════════════════════════════════\n');

  const sweeps:    SweepRecord[] = [];
  let sweep_ok   = 0;
  let sweep_zero = 0;
  let sweep_fail = 0;

  for (const user of validUsers) {
    // Read classic Stellar USDC balance from Horizon
    let usdcBalance = '0';
    try {
      const account = await horizon.loadAccount(user.stellar_public_key);
      const usdcEntry = account.balances.find(
        b =>
          b.asset_type    === 'credit_alphanum4' &&
          (b as any).asset_code   === 'USDC' &&
          (b as any).asset_issuer === usdcIssuer,
      );
      usdcBalance = usdcEntry ? usdcEntry.balance : '0';
    } catch (err: any) {
      log('FAIL', user.username, `Horizon loadAccount error: ${err.message as string}`);
      sweep_fail++;
      continue;
    }

    const amountStroops = usdcToStroops(usdcBalance);
    if (amountStroops === 0n) {
      log('SKIP', user.username, 'Classic USDC balance is 0 — nothing to sweep');
      sweep_zero++;
      continue;
    }

    log('PLAN', user.username, `Sweep ${usdcBalance} USDC → contract`);

    try {
      const txHash = await sweepUserUsdc({
        sorobanRpc,
        networkPass,
        usdcSacId,
        contractId: contractId!,
        userKeypair: user.keypair,
        amountStroops,
      });

      log('OK  ', user.username, `Swept ${usdcBalance} USDC — tx: ${txHash}`);
      sweeps.push({ user, amount: usdcBalance, txHash });
      sweep_ok++;
    } catch (err: any) {
      log('FAIL', user.username, `SAC transfer failed: ${err.message as string}`);
      sweep_fail++;
    }
  }

  console.log(`\n  Phase 2 complete: ${sweep_ok} swept, ${sweep_zero} skipped (zero balance), ${sweep_fail} failed.\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // RECOVERY — Users whose Phase 2 sweep succeeded in a prior run but whose
  // Phase 3 credit failed (classic wallet is now 0, so Phase 2 skips them).
  // Add entries here manually and re-run the script.  Phase 3 is idempotent —
  // if the credit was already applied it will be skipped gracefully.
  // ─────────────────────────────────────────────────────────────────────────────
  const PRIOR_SWEEPS: Array<{ stellarPublicKey: string; amountUsdc: string; txHash: string }> = [
    // inkman: swept 2.0 USDC in prior run, Phase 3 failed because Phase 1 had not registered them yet
    {
      stellarPublicKey: 'GDSQFWAT3I2MOTBFHSM3YKJW2GVQEARVAGY6BSOUVLTM46LDL2JYLAWX',
      amountUsdc:       '2.0000000',
      txHash:           '20ac93a9f569ce93dab054d94100582e80da0c5d3771c81932b2bdef2c6bdc7c',
    },
    // xaxxoo: swept 0.0449930 USDC in prior run
    {
      stellarPublicKey: 'GANZPCJN3ZRHMYNULTLXAWXW3T3LSYNWSOFEFQ743YL3T57CNBTUCMJC',
      amountUsdc:       '0.0449930',
      txHash:           '93e1a17ce282169ea67652fc35725e7366de52d1dc4d81c50e691e3e99030f0e',
    },
    // nafiuishaaq: swept 0.0350767 USDC in prior run
    {
      stellarPublicKey: 'GCS62QMMF5572QASMKEJLRZYJYSXBSXG32OGTGL5RDLGVMYC73E22W3A',
      amountUsdc:       '0.0350767',
      txHash:           'b11b2bb112a6fd29b25d10e6c16b1987e6a0732912118cbc00a3220ced2c28c3',
    },
  ];

  for (const prior of PRIOR_SWEEPS) {
    const user = validUsers.find(u => u.stellar_public_key === prior.stellarPublicKey);
    if (user) {
      sweeps.push({ user, amount: prior.amountUsdc, txHash: prior.txHash });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 3 — Credit each user's internal balance in the contract
  // Calls deposit_by_address(address, amount, sweep_txHash) for every
  // successful Phase 2 sweep. The sweep tx hash serves as the deposit_id
  // (idempotent — safe to re-run if Phase 3 is interrupted).
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('══════════════════════════════════════════════════════════');
  console.log('  PHASE 3 — Credit internal contract balances');
  console.log('══════════════════════════════════════════════════════════\n');

  let credit_ok   = 0;
  let credit_skip = 0;
  let credit_fail = 0;

  for (const { user, amount, txHash: sweepTxHash } of sweeps) {
    const amountStroops = usdcToStroops(amount);

    try {
      const op = contract.call(
        'deposit_by_address',
        StellarSdk.nativeToScVal(user.stellar_public_key, { type: 'address' }),
        StellarSdk.nativeToScVal(amountStroops,            { type: 'i128'    }),
        StellarSdk.nativeToScVal(sweepTxHash,              { type: 'string'  }),
      );

      const creditTxHash = await platformSorobanTx(sorobanRpc, networkPass, platformKeypair, op);
      log('OK  ', user.username, `Credited ${amount} USDC — tx: ${creditTxHash}`);
      credit_ok++;
    } catch (err: any) {
      const msg = err.message as string;
      if (msg.includes('DepositAlreadyProcessed')) {
        log('SKIP', user.username, `deposit_id already processed (idempotent re-run)`);
        credit_skip++;
      } else {
        log('FAIL', user.username, `deposit_by_address failed: ${msg}`);
        credit_fail++;
      }
    }
  }

  console.log(`\n  Phase 3 complete: ${credit_ok} credited, ${credit_skip} already processed, ${credit_fail} failed.\n`);

  // ── Summary ──────────────────────────────────────────────────────────────────

  console.log('══════════════════════════════════════════════════════════');
  console.log('  MIGRATION SUMMARY');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  Users validated:   ${validUsers.length}`);
  console.log(`  Registered:        ${reg_ok}  (${reg_skip} already existed, ${reg_fail} failed)`);
  console.log(`  USDC swept:        ${sweep_ok}  (${sweep_zero} had zero balance, ${sweep_fail} failed)`);
  console.log(`  Balances credited: ${credit_ok}  (${credit_skip} already credited, ${credit_fail} failed)`);

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] No transactions were submitted.');
    console.log('  Re-run with --execute to apply.\n');
  } else {
    const hasFailures = reg_fail + sweep_fail + credit_fail > 0;
    if (hasFailures) {
      console.log('\n  ⚠  Some users failed. Re-run the script — it is idempotent.');
      console.log('     Already-registered and already-credited users will be skipped.\n');
    } else {
      console.log('\n  Migration complete. You can now re-enable STELLAR_CONTRACT_ID.\n');
    }
  }

  await db.destroy();
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
