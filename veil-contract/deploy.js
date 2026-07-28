#!/usr/bin/env node
// veil-contract/deploy.js
//
// Deploys and initializes the VeilPool Soroban contract on Stellar testnet.
// Uses Node.js TLS (system cert store) to avoid the rustls cert issue.
//
// Usage: node deploy.js
//
// Outputs: VEIL_POOL_CONTRACT_ID=<contract-id>

const fs = require('fs');
const path = require('path');

const {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Operation,
  Address,
  nativeToScVal,
  xdr,
} = require('@stellar/stellar-sdk');
const { Server, assembleTransaction } = require('@stellar/stellar-sdk').rpc;

// ── Config ──────────────────────────────────────────────────────────────────
const TESTNET_RPC   = 'https://soroban-testnet.stellar.org';
const TESTNET_PASS  = Networks.TESTNET;

// Deployer — funded testnet account
const DEPLOYER_SECRET = 'SD4OTTU5L7FXLQJFTJPITWAOCZL2RBJJHLXQRKDDBULXG4OZXTJNE7BH';

// Platform account (operator) — will be authorised to call withdraw()
// Using platform-account key from stellar keys ls
const PLATFORM_SECRET_OR_ADDRESS = process.env.PLATFORM_ADDRESS
  || 'GDIYTK73ATDVJVM5OAXGHVJ23CH5FAXC2M7PKIO27YJQSUHQDK47UIHK';

// Testnet USDC (Circle-issued SAC on testnet)
// https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets
const TESTNET_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const TESTNET_USDC_CONTRACT = process.env.TESTNET_USDC_CONTRACT
  || 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

// Hot wallet — where withdrawals are routed
const HOT_WALLET = process.env.HOT_WALLET
  || PLATFORM_SECRET_OR_ADDRESS; // default: operator is also the hot wallet

// ── Helpers ──────────────────────────────────────────────────────────────────

async function submitAndWait(server, tx) {
  const response = await server.sendTransaction(tx);
  if (response.status === 'ERROR') {
    throw new Error(`sendTransaction error: ${JSON.stringify(response)}`);
  }
  let result;
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    result = await server.getTransaction(response.hash);
    if (result.status !== 'NOT_FOUND') break;
  }
  if (result.status !== 'SUCCESS') {
    throw new Error(`Transaction failed: ${result.status}\n${JSON.stringify(result)}`);
  }
  return result;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getAccount(server, publicKey) {
  return server.getAccount(publicKey);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const server = new Server(TESTNET_RPC);
  const deployer = Keypair.fromSecret(DEPLOYER_SECRET);

  const wasmPath = path.join(__dirname, 'target/wasm32v1-none/release/veil_pool.wasm');
  const wasm = fs.readFileSync(wasmPath);

  console.log(`Deployer:    ${deployer.publicKey()}`);
  console.log(`Operator:    ${PLATFORM_SECRET_OR_ADDRESS}`);
  console.log(`Hot wallet:  ${HOT_WALLET}`);
  console.log(`USDC:        ${TESTNET_USDC_CONTRACT}`);
  console.log(`WASM size:   ${wasm.length} bytes\n`);

  // ── Step 1: Upload WASM ──────────────────────────────────────────────────
  console.log('Step 1/3: Uploading WASM...');
  const account1 = await getAccount(server, deployer.publicKey());
  const uploadTx = new TransactionBuilder(account1, {
    fee: (parseInt(BASE_FEE) * 100).toString(),
    networkPassphrase: TESTNET_PASS,
  })
    .addOperation(Operation.uploadContractWasm({ wasm }))
    .setTimeout(300)
    .build();

  const simUpload = await server.simulateTransaction(uploadTx);
  if (simUpload.error) throw new Error(`Simulate upload failed: ${simUpload.error}`);

  const assembledUpload = assembleTransaction(uploadTx, simUpload).build();
  assembledUpload.sign(deployer);

  const uploadResult = await submitAndWait(server, assembledUpload);
  const wasmHash = uploadResult.returnValue
    ? Buffer.from(uploadResult.returnValue.bytes()).toString('hex')
    : 'unknown';
  console.log(`  WASM hash: ${wasmHash}`);

  // ── Step 2: Deploy contract instance ────────────────────────────────────
  console.log('Step 2/3: Deploying contract instance...');
  const account2 = await getAccount(server, deployer.publicKey());
  const deployTx = new TransactionBuilder(account2, {
    fee: (parseInt(BASE_FEE) * 100).toString(),
    networkPassphrase: TESTNET_PASS,
  })
    .addOperation(
      Operation.createCustomContract({
        address: new Address(deployer.publicKey()),
        wasmHash: Buffer.from(wasmHash, 'hex'),
      }),
    )
    .setTimeout(300)
    .build();

  const simDeploy = await server.simulateTransaction(deployTx);
  if (simDeploy.error) throw new Error(`Simulate deploy failed: ${simDeploy.error}`);

  const assembledDeploy = assembleTransaction(deployTx, simDeploy).build();
  assembledDeploy.sign(deployer);

  const deployResult = await submitAndWait(server, assembledDeploy);

  // Extract contract ID from the return value (Address)
  let contractId;
  if (deployResult.returnValue) {
    try {
      contractId = Address.fromScVal(deployResult.returnValue).toString();
    } catch {
      const hex = Buffer.from(deployResult.returnValue.toXDR()).toString('hex');
      contractId = `raw:${hex}`;
    }
  }
  console.log(`  Contract ID: ${contractId}`);

  // ── Step 3: Initialize contract ──────────────────────────────────────────
  console.log('Step 3/3: Initializing VeilPool...');
  const account3 = await getAccount(server, deployer.publicKey());

  const adminAddr   = nativeToScVal(new Address(deployer.publicKey()), { type: 'address' });
  const usdcAddr    = nativeToScVal(new Address(TESTNET_USDC_CONTRACT), { type: 'address' });
  const hotWalletAddr = nativeToScVal(new Address(HOT_WALLET), { type: 'address' });
  const operatorAddr  = nativeToScVal(new Address(PLATFORM_SECRET_OR_ADDRESS), { type: 'address' });

  const initTx = new TransactionBuilder(account3, {
    fee: (parseInt(BASE_FEE) * 100).toString(),
    networkPassphrase: TESTNET_PASS,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: 'initialize',
        args: [adminAddr, usdcAddr, hotWalletAddr, operatorAddr],
      }),
    )
    .setTimeout(300)
    .build();

  const simInit = await server.simulateTransaction(initTx);
  if (simInit.error) throw new Error(`Simulate init failed: ${simInit.error}`);

  const assembledInit = assembleTransaction(initTx, simInit).build();
  assembledInit.sign(deployer);

  await submitAndWait(server, assembledInit);
  console.log('  Initialized ✓');

  // ── Done ─────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log(`VEIL_POOL_CONTRACT_ID=${contractId}`);
  console.log('══════════════════════════════════════════════');
  console.log('\nAdd this to your .env file on Railway.');
}

main().catch(err => {
  console.error('\nDeploy failed:', err.message || err);
  process.exit(1);
});
