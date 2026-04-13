import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as StellarSdk from '@stellar/stellar-sdk';
import * as crypto from 'crypto';
import { ContractCallException } from '../exceptions/blockchain.exceptions';

// ─────────────────────────────────────────────────────────────────────────────
// Return types
// ─────────────────────────────────────────────────────────────────────────────

export interface EvmWalletCreationResult {
  walletAddress: string;
  txHash: string;
  blockNumber: number;
  gasUsed: string;
}

export interface StellarWalletCreationResult {
  publicKey: string;
  secretKeyEnc: string;
}

export interface ContractOperationResult {
  txHash: string;
  blockNumber: number;
  gasUsed: string;
  balanceAfter: string;
}

export interface StellarTransferResult {
  txHash: string;
  balanceAfter: string;
}

export interface StellarPayment {
  txHash:      string;
  from:        string;
  to:          string;
  amount:      string;
  assetCode:   string;
  assetIssuer: string;
  createdAt:   string;
  pagingToken: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// USDC issuers
// ─────────────────────────────────────────────────────────────────────────────

const STELLAR_USDC_ISSUERS = {
  mainnet: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  testnet: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
};

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);

  // ── EVM ────────────────────────────────────────────────────────────────
  private evmProvider:   ethers.JsonRpcProvider;
  private evmSigner:     ethers.Wallet;
  private evmContract:   ethers.Contract;
  private tokenDecimals: number;
  private evmReady = false;

  // ── Stellar ────────────────────────────────────────────────────────────
  private stellarServer:           StellarSdk.Horizon.Server;
  private stellarNetwork:          string;
  private stellarPlatformKeypair:  StellarSdk.Keypair;
  private stellarUsdcIssuer:       string;
  private stellarReady = false;

  // ── Encryption ─────────────────────────────────────────────────────────
  private encryptionKey: Buffer;
  private encryptionReady = false;

  // ── Contract ABI ───────────────────────────────────────────────────────
  private readonly CONTRACT_ABI = [
    'function createWallet(address user, string calldata username) external returns (address walletAddress)',
    'function debit(address wallet, uint256 amount, string calldata ref) external returns (bool)',
    'function credit(address wallet, uint256 amount, string calldata ref) external returns (bool)',
    'function transferByUsername(string calldata fromUsername, string calldata toUsername, uint256 amount, string calldata ref) external returns (bool)',
    'function getBalance(address wallet) external view returns (uint256)',
    'function getWalletByUsername(string calldata username) external view returns (address)',
    'function tokenDecimals() external view returns (uint8)',
    'event WalletCreated(address indexed user, address indexed wallet, string username)',
    'event Debited(address indexed wallet, uint256 amount, string ref)',
    'event Credited(address indexed wallet, uint256 amount, string ref)',
    'event Transferred(address indexed fromWallet, address indexed toWallet, uint256 amount, string ref)',
  ];

  constructor(private readonly config: ConfigService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Initialisation — each chain boots independently, app never crashes on
  // missing / placeholder config
  // ─────────────────────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    const rpcUrl      = this.config.get<string>('BLOCKCHAIN_RPC_URL');
    const privateKey  = this.config.get<string>('PLATFORM_WALLET_PRIVATE_KEY');
    const contractAddr = this.config.get<string>('WALLET_CONTRACT_ADDRESS');

    const stellarSecret = this.config.get<string>('STELLAR_PLATFORM_SECRET_KEY');
    const horizonUrl    = this.config.get<string>('STELLAR_HORIZON_URL');

    const encKey = this.config.get<string>('SECRET_ENCRYPTION_KEY');

    // EVM — only init if all three vars are present and non-placeholder
    if (
      rpcUrl && privateKey && contractAddr &&
      !privateKey.includes('placeholder') &&
      !contractAddr.includes('placeholder')
    ) {
      try {
        await this.initEvm(rpcUrl, privateKey, contractAddr);
        this.evmReady = true;
      } catch (err) {
        this.logger.error(`EVM init failed: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn('EVM not configured — blockchain EVM features disabled');
    }

    // Stellar — only init if secret looks like a real Stellar secret key (starts with S)
    if (
      horizonUrl && stellarSecret &&
      stellarSecret.startsWith('S') &&
      !stellarSecret.includes('placeholder')
    ) {
      try {
        await this.initStellar(horizonUrl, stellarSecret);
        this.stellarReady = true;
      } catch (err) {
        this.logger.error(`Stellar init failed: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn('Stellar not configured — Stellar features disabled');
    }

    // Encryption — only init if key is exactly 64 hex chars
    if (encKey && encKey.length === 64 && !encKey.includes('placeholder')) {
      try {
        this.initEncryption(encKey);
        this.encryptionReady = true;
      } catch (err) {
        this.logger.error(`Encryption init failed: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn('SECRET_ENCRYPTION_KEY not configured — encryption disabled');
    }
  }

  private async initEvm(
    rpcUrl: string,
    privateKey: string,
    contractAddress: string,
  ): Promise<void> {
    this.evmProvider = new ethers.JsonRpcProvider(rpcUrl);
    this.evmSigner   = new ethers.Wallet(privateKey, this.evmProvider);
    this.evmContract = new ethers.Contract(contractAddress, this.CONTRACT_ABI, this.evmSigner);

    this.tokenDecimals = Number(await this.evmContract.tokenDecimals());

    const network = await this.evmProvider.getNetwork();
    this.logger.log(
      `EVM ready [chain=${network.name}] [chainId=${network.chainId}]` +
      ` [contract=${contractAddress}] [signer=${this.evmSigner.address}]` +
      ` [tokenDecimals=${this.tokenDecimals}]`,
    );
  }

  private async initStellar(horizonUrl: string, secretKey: string): Promise<void> {
    const network   = this.config.get<string>('STELLAR_NETWORK', 'testnet');
    const isMainnet = network === 'mainnet';

    this.stellarServer          = new StellarSdk.Horizon.Server(horizonUrl);
    this.stellarNetwork         = isMainnet ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;
    this.stellarPlatformKeypair = StellarSdk.Keypair.fromSecret(secretKey);
    this.stellarUsdcIssuer      = isMainnet ? STELLAR_USDC_ISSUERS.mainnet : STELLAR_USDC_ISSUERS.testnet;

    const account   = await this.stellarServer.loadAccount(this.stellarPlatformKeypair.publicKey());
    const xlmBalance = account.balances.find((b) => b.asset_type === 'native');
    this.logger.log(
      `Stellar ready [network=${network}]` +
      ` [platform=${this.stellarPlatformKeypair.publicKey()}]` +
      ` [xlm=${xlmBalance?.balance ?? '?'}]`,
    );
  }

  private initEncryption(keyHex: string): void {
    this.encryptionKey = Buffer.from(keyHex, 'hex');
    this.logger.log('Encryption ready');
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  private requireEvm(operation: string): void {
    if (!this.evmReady) {
      throw new ContractCallException(operation, 'EVM not initialised — check BLOCKCHAIN_RPC_URL, PLATFORM_WALLET_PRIVATE_KEY, WALLET_CONTRACT_ADDRESS');
    }
  }

  private requireStellar(operation: string): void {
    if (!this.stellarReady) {
      throw new ContractCallException(operation, 'Stellar not initialised — check STELLAR_HORIZON_URL, STELLAR_PLATFORM_SECRET_KEY');
    }
  }

  private requireEncryption(operation: string): void {
    if (!this.encryptionReady) {
      throw new ContractCallException(operation, 'Encryption not initialised — check SECRET_ENCRYPTION_KEY');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM — Wallet creation
  // ─────────────────────────────────────────────────────────────────────────

  async createEvmWallet(evmAddress: string, username: string): Promise<EvmWalletCreationResult> {
    this.requireEvm('createEvmWallet');
    this.logger.log(`createEvmWallet [username=${username}] [evmAddress=${evmAddress}]`);
    try {
      const tx      = await this.evmContract.createWallet(evmAddress, username.toLowerCase());
      const receipt = await tx.wait(1) as ethers.TransactionReceipt;
      const walletAddress = this.parseEventArg(receipt, 'WalletCreated', 'wallet');

      this.logger.log(
        `createEvmWallet confirmed [username=${username}]` +
        ` [wallet=${walletAddress}] [txHash=${receipt.hash}]`,
      );

      return {
        walletAddress: ethers.getAddress(walletAddress),
        txHash:        receipt.hash,
        blockNumber:   receipt.blockNumber,
        gasUsed:       receipt.gasUsed.toString(),
      };
    } catch (err) {
      throw this.wrapError('createEvmWallet', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM — Balance
  // ─────────────────────────────────────────────────────────────────────────

  async getEvmBalance(walletAddress: string): Promise<string> {
    this.requireEvm('getEvmBalance');
    try {
      const raw: bigint = await this.evmContract.getBalance(walletAddress);
      return this.toHuman(raw);
    } catch (err) {
      throw this.wrapError('getEvmBalance', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM — Debit / Credit / Transfer
  // ─────────────────────────────────────────────────────────────────────────

  async evmDebit(walletAddress: string, amount: string, appReference: string): Promise<ContractOperationResult> {
    this.requireEvm('evmDebit');
    const units = this.toUnits(amount);
    this.logger.log(`evmDebit [wallet=${walletAddress}] [amount=${amount}] [ref=${appReference}]`);
    try {
      const tx      = await this.evmContract.debit(walletAddress, units, appReference);
      const receipt = await tx.wait(1) as ethers.TransactionReceipt;
      const balanceAfter = await this.getEvmBalance(walletAddress);
      this.logger.log(`evmDebit confirmed [txHash=${receipt.hash}] [balanceAfter=${balanceAfter}]`);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(), balanceAfter };
    } catch (err) {
      throw this.wrapError('evmDebit', err);
    }
  }

  async evmCredit(walletAddress: string, amount: string, appReference: string): Promise<ContractOperationResult> {
    this.requireEvm('evmCredit');
    const units = this.toUnits(amount);
    this.logger.log(`evmCredit [wallet=${walletAddress}] [amount=${amount}] [ref=${appReference}]`);
    try {
      const tx      = await this.evmContract.credit(walletAddress, units, appReference);
      const receipt = await tx.wait(1) as ethers.TransactionReceipt;
      const balanceAfter = await this.getEvmBalance(walletAddress);
      this.logger.log(`evmCredit confirmed [txHash=${receipt.hash}] [balanceAfter=${balanceAfter}]`);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(), balanceAfter };
    } catch (err) {
      throw this.wrapError('evmCredit', err);
    }
  }

  async evmTransferByUsername(
    fromUsername: string,
    toUsername: string,
    amount: string,
    appReference: string,
  ): Promise<ContractOperationResult> {
    this.requireEvm('evmTransferByUsername');
    const units = this.toUnits(amount);
    this.logger.log(`evmTransferByUsername [@${fromUsername} → @${toUsername}] [amount=${amount}]`);
    try {
      const tx      = await this.evmContract.transferByUsername(fromUsername.toLowerCase(), toUsername.toLowerCase(), units, appReference);
      const receipt = await tx.wait(1) as ethers.TransactionReceipt;
      const senderWallet = await this.resolveEvmUsername(fromUsername);
      const balanceAfter = senderWallet ? await this.getEvmBalance(senderWallet) : '0.00000000';
      this.logger.log(`evmTransferByUsername confirmed [txHash=${receipt.hash}] [@${fromUsername} balanceAfter=${balanceAfter}]`);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(), balanceAfter };
    } catch (err) {
      throw this.wrapError('evmTransferByUsername', err);
    }
  }

  async resolveEvmUsername(username: string): Promise<string | null> {
    this.requireEvm('resolveEvmUsername');
    try {
      const address: string = await this.evmContract.getWalletByUsername(username.toLowerCase());
      const zero = '0x0000000000000000000000000000000000000000';
      return address === zero ? null : ethers.getAddress(address);
    } catch (err) {
      throw this.wrapError('resolveEvmUsername', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stellar — Wallet creation
  // ─────────────────────────────────────────────────────────────────────────

  async createStellarWallet(): Promise<StellarWalletCreationResult> {
    this.requireStellar('createStellarWallet');
    this.requireEncryption('createStellarWallet');

    const keypair   = StellarSdk.Keypair.random();
    const publicKey = keypair.publicKey();
    this.logger.log(`createStellarWallet [publicKey=${publicKey}]`);

    try {
      await this.fundStellarAccount(publicKey);
      await this.ensureTrustline(keypair);
      const secretKeyEnc = this.encryptSecret(keypair.secret());
      this.logger.log(`createStellarWallet complete [publicKey=${publicKey}]`);
      return { publicKey, secretKeyEnc };
    } catch (err) {
      throw this.wrapError('createStellarWallet', err);
    }
  }

  private async fundStellarAccount(newPublicKey: string): Promise<void> {
    this.logger.log(`fundStellarAccount [target=${newPublicKey}]`);
    const platformAccount = await this.stellarServer.loadAccount(this.stellarPlatformKeypair.publicKey());

    const tx = new StellarSdk.TransactionBuilder(platformAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.stellarNetwork,
    })
      .addOperation(StellarSdk.Operation.createAccount({ destination: newPublicKey, startingBalance: '1.6' }))
      .setTimeout(30)
      .build();

    tx.sign(this.stellarPlatformKeypair);
    const result = await this.stellarServer.submitTransaction(tx);
    this.logger.log(`fundStellarAccount submitted [hash=${result.hash}]`);
  }

  async ensureTrustline(keypairOrEnc: StellarSdk.Keypair | string): Promise<void> {
    this.requireStellar('ensureTrustline');

    const keypair = typeof keypairOrEnc === 'string'
      ? StellarSdk.Keypair.fromSecret(this.decryptSecret(keypairOrEnc))
      : keypairOrEnc;

    const publicKey = keypair.publicKey();
    this.logger.log(`ensureTrustline [publicKey=${publicKey}]`);

    const account = await this.stellarServer.loadAccount(publicKey);
    const hasUsdcTrustline = account.balances.some(
      (b) =>
        b.asset_type === 'credit_alphanum4' &&
        (b as StellarSdk.Horizon.HorizonApi.BalanceLine<'credit_alphanum4'>).asset_code   === 'USDC' &&
        (b as StellarSdk.Horizon.HorizonApi.BalanceLine<'credit_alphanum4'>).asset_issuer === this.stellarUsdcIssuer,
    );

    if (hasUsdcTrustline) {
      this.logger.debug(`ensureTrustline: USDC trustline already exists [publicKey=${publicKey}]`);
      return;
    }

    const usdcAsset = new StellarSdk.Asset('USDC', this.stellarUsdcIssuer);
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.stellarNetwork,
    })
      .addOperation(StellarSdk.Operation.changeTrust({ asset: usdcAsset }))
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    const result = await this.stellarServer.submitTransaction(tx);
    this.logger.log(`ensureTrustline submitted [hash=${result.hash}] [publicKey=${publicKey}]`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stellar — Balance
  // ─────────────────────────────────────────────────────────────────────────

  async getStellarUsdcBalance(publicKey: string): Promise<string> {
    this.requireStellar('getStellarUsdcBalance');
    try {
      const account     = await this.stellarServer.loadAccount(publicKey);
      const usdcBalance = account.balances.find(
        (b) =>
          b.asset_type === 'credit_alphanum4' &&
          (b as StellarSdk.Horizon.HorizonApi.BalanceLine<'credit_alphanum4'>).asset_code   === 'USDC' &&
          (b as StellarSdk.Horizon.HorizonApi.BalanceLine<'credit_alphanum4'>).asset_issuer === this.stellarUsdcIssuer,
      ) as StellarSdk.Horizon.HorizonApi.BalanceLine<'credit_alphanum4'> | undefined;
      return usdcBalance?.balance ?? '0.0000000';
    } catch (err) {
      throw this.wrapError('getStellarUsdcBalance', err);
    }
  }

  async getStellarXlmBalance(publicKey: string): Promise<string> {
    this.requireStellar('getStellarXlmBalance');
    try {
      const account = await this.stellarServer.loadAccount(publicKey);
      const xlm     = account.balances.find((b) => b.asset_type === 'native');
      return xlm?.balance ?? '0.0000000';
    } catch (err) {
      throw this.wrapError('getStellarXlmBalance', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stellar — USDC transfer
  // ─────────────────────────────────────────────────────────────────────────

  async sendStellarUsdc(opts: {
    fromSecretEnc: string;
    toPublicKey: string;
    amountUsdc: string;
    memo?: string;
  }): Promise<StellarTransferResult> {
    this.requireStellar('sendStellarUsdc');
    this.requireEncryption('sendStellarUsdc');

    const { fromSecretEnc, toPublicKey, amountUsdc, memo } = opts;
    const senderKeypair   = StellarSdk.Keypair.fromSecret(this.decryptSecret(fromSecretEnc));
    const senderPublicKey = senderKeypair.publicKey();
    this.logger.log(`sendStellarUsdc [from=${senderPublicKey}] [to=${toPublicKey}] [amount=${amountUsdc}]`);

    try {
      const senderAccount = await this.stellarServer.loadAccount(senderPublicKey);
      const usdcAsset     = new StellarSdk.Asset('USDC', this.stellarUsdcIssuer);
      const txBuilder     = new StellarSdk.TransactionBuilder(senderAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.stellarNetwork,
      }).addOperation(StellarSdk.Operation.payment({ destination: toPublicKey, asset: usdcAsset, amount: amountUsdc }));

      if (memo) txBuilder.addMemo(StellarSdk.Memo.text(memo.slice(0, 28)));

      const tx = txBuilder.setTimeout(30).build();
      tx.sign(senderKeypair);

      const result      = await this.stellarServer.submitTransaction(tx);
      const balanceAfter = await this.getStellarUsdcBalance(senderPublicKey);
      this.logger.log(`sendStellarUsdc confirmed [hash=${result.hash}] [balanceAfter=${balanceAfter}]`);
      return { txHash: result.hash, balanceAfter };
    } catch (err) {
      if (err && typeof err === 'object' && 'response' in err && (err as any).response?.data) {
        const ops = (err as any).response.data?.extras?.result_codes?.operations;
        const msg = ops ? `Stellar op error: ${ops.join(', ')}` : String(err);
        throw new ContractCallException('sendStellarUsdc', msg);
      }
      throw this.wrapError('sendStellarUsdc', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stellar — Platform deposit / withdraw
  // ─────────────────────────────────────────────────────────────────────────

  async platformDepositUsdc(toPublicKey: string, amountUsdc: string): Promise<string> {
    this.requireStellar('platformDepositUsdc');
    this.requireEncryption('platformDepositUsdc');
    this.logger.log(`platformDepositUsdc [to=${toPublicKey}] [amount=${amountUsdc}]`);
    const result = await this.sendStellarUsdc({
      fromSecretEnc: this.encryptSecret(this.stellarPlatformKeypair.secret()),
      toPublicKey,
      amountUsdc,
      memo: 'Cheese deposit',
    });
    return result.txHash;
  }

  async platformWithdrawUsdc(fromSecretEnc: string, amountUsdc: string, reference: string): Promise<string> {
    this.requireStellar('platformWithdrawUsdc');
    const keypair = StellarSdk.Keypair.fromSecret(this.decryptSecret(fromSecretEnc));
    this.logger.log(`platformWithdrawUsdc [from=${keypair.publicKey()}] [amount=${amountUsdc}]`);
    const result = await this.sendStellarUsdc({
      fromSecretEnc,
      toPublicKey: this.stellarPlatformKeypair.publicKey(),
      amountUsdc,
      memo: reference.slice(0, 28),
    });
    return result.txHash;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Encryption — AES-256-GCM
  // ─────────────────────────────────────────────────────────────────────────

  encryptSecret(secret: string): string {
    this.requireEncryption('encryptSecret');
    const iv        = crypto.randomBytes(12);
    const cipher    = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag   = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decryptSecret(encryptedSecret: string): string {
    this.requireEncryption('decryptSecret');
    const [ivHex, authTagHex, ciphertextHex] = encryptedSecret.split(':');
    if (!ivHex || !authTagHex || !ciphertextHex) throw new Error('Invalid encrypted secret format');
    const iv         = Buffer.from(ivHex, 'hex');
    const authTag    = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const decipher   = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM helpers
  // ─────────────────────────────────────────────────────────────────────────

  getEvmSignerAddress(): string   { this.requireEvm('getEvmSignerAddress');   return this.evmSigner.address; }
  getEvmContractAddress(): string { this.requireEvm('getEvmContractAddress'); return this.evmContract.target as string; }
  getTokenDecimals(): number      { this.requireEvm('getTokenDecimals');      return this.tokenDecimals; }

  async getEvmChainId(): Promise<number> {
    this.requireEvm('getEvmChainId');
    const network = await this.evmProvider.getNetwork();
    return Number(network.chainId);
  }

  toUnits(amount: string): bigint {
    return ethers.parseUnits(amount, this.tokenDecimals);
  }

  toHuman(raw: bigint): string {
    return parseFloat(ethers.formatUnits(raw, this.tokenDecimals)).toFixed(8);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stellar helpers
  // ─────────────────────────────────────────────────────────────────────────

  getStellarPlatformPublicKey(): string {
    this.requireStellar('getStellarPlatformPublicKey');
    return this.stellarPlatformKeypair.publicKey();
  }

  getStellarUsdcIssuer(): string {
    this.requireStellar('getStellarUsdcIssuer');
    return this.stellarUsdcIssuer;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private parseEventArg(receipt: ethers.TransactionReceipt, eventName: string, argName: string): string {
    const iface      = this.evmContract.interface;
    const eventTopic = iface.getEvent(eventName)!.topicHash;
    const log        = receipt.logs.find((l) => l.topics[0] === eventTopic);
    if (!log) throw new ContractCallException(eventName, `${eventName} event not found in receipt`);
    const parsed = iface.parseLog({ topics: [...log.topics], data: log.data })!;
    return parsed.args[argName] as string;
  }

  private wrapError(operation: string, err: unknown): ContractCallException {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`Blockchain call failed [operation=${operation}]: ${message}`);
    return new ContractCallException(operation, message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Backward-compatible aliases
  // ─────────────────────────────────────────────────────────────────────────

  /** @deprecated use getEvmSignerAddress() */
  getSignerAddress(): string { return this.getEvmSignerAddress(); }

  /** @deprecated use getEvmContractAddress() */
  getContractAddress(): string { return this.getEvmContractAddress(); }

  /** @deprecated use getEvmChainId() */
  async getChainId(): Promise<number> { return this.getEvmChainId(); }

  /** @deprecated use createEvmWallet() */
  async createWallet(evmAddress: string, username: string): Promise<EvmWalletCreationResult> {
    return this.createEvmWallet(evmAddress, username);
  }

  /** @deprecated use getEvmBalance() */
  async getBalance(walletAddress: string): Promise<string> { return this.getEvmBalance(walletAddress); }

  /** @deprecated use resolveEvmUsername() */
  async resolveUsername(username: string): Promise<string | null> { return this.resolveEvmUsername(username); }

  /** @deprecated use evmTransferByUsername() */
  async transferByUsername(from: string, to: string, amount: string, ref: string): Promise<ContractOperationResult> {
    return this.evmTransferByUsername(from, to, amount, ref);
  }

  /** @deprecated use evmDebit() */
  async debit(wallet: string, amount: string, ref: string): Promise<ContractOperationResult> {
    return this.evmDebit(wallet, amount, ref);
  }

  /** @deprecated use evmCredit() */
  async credit(wallet: string, amount: string, ref: string): Promise<ContractOperationResult> {
    return this.evmCredit(wallet, amount, ref);
  }

  /** @deprecated use getStellarUsdcBalance() */
  async getStellarBalance(publicKey: string): Promise<{ usdc: string }> {
    const usdc = await this.getStellarUsdcBalance(publicKey);
    return { usdc };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Previously stubbed methods — now properly implemented
  // ─────────────────────────────────────────────────────────────────────────

  async sendUsdc(opts: { fromSecretEnc: string; toAddress: string; amountUsdc: string; memo?: string }): Promise<string> {
    const result = await this.sendStellarUsdc({ fromSecretEnc: opts.fromSecretEnc, toPublicKey: opts.toAddress, amountUsdc: opts.amountUsdc, memo: opts.memo });
    return result.txHash;
  }

  async getUsdcBalance(publicKey: string): Promise<{ usdc: string }> {
    const usdc = await this.getStellarUsdcBalance(publicKey);
    return { usdc };
  }

  async getContractBalance(username: string): Promise<string> {
    const walletAddress = await this.resolveEvmUsername(username);
    if (!walletAddress) return '0.00000000';
    return this.getEvmBalance(walletAddress);
  }

  async registerUser(username: string, evmAddress: string): Promise<string> {
    const result = await this.createEvmWallet(evmAddress, username);
    return result.txHash;
  }

  async contractDeposit(username: string, amountUsdc: string): Promise<void> {
    const walletAddress = await this.resolveEvmUsername(username);
    if (!walletAddress) throw new ContractCallException('contractDeposit', `No EVM wallet for username: ${username}`);
    await this.evmCredit(walletAddress, amountUsdc, `deposit:${username}`);
  }

  async contractDepositByAddress(stellarAddress: string, amountUsdc: string): Promise<void> {
    await this.evmCredit(stellarAddress, amountUsdc, `deposit-bridge:${stellarAddress}`);
  }

  async contractWithdraw(username: string, amountUsdc: string, toAddress: string): Promise<void> {
    const walletAddress = await this.resolveEvmUsername(username);
    if (!walletAddress) throw new ContractCallException('contractWithdraw', `No EVM wallet for username: ${username}`);
    await this.evmDebit(walletAddress, amountUsdc, `withdraw:${username}:${toAddress}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Ready state — used by schedulers to bail early if chains not configured
  // ─────────────────────────────────────────────────────────────────────────

  get isStellarReady(): boolean {
    return this.stellarReady;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stellar — inbound payment polling (deposit detection)
  // ─────────────────────────────────────────────────────────────────────────

  async fetchInboundStellarUsdc(
    publicKey: string,
    cursor?: string,
  ): Promise<StellarPayment[]> {
    this.requireStellar('fetchInboundStellarUsdc');

    let builder = this.stellarServer
      .payments()
      .forAccount(publicKey)
      .order('asc' as const)
      .limit(50);

    if (cursor) {
      builder = builder.cursor(cursor);
    }

    const response = await builder.call();
    const results: StellarPayment[] = [];

    for (const record of response.records) {
      // Only process payment operations (not path_payment, etc.)
      if (record.type !== 'payment') continue;

      const payment = record as any;

      // Only USDC on the configured issuer
      if (payment.asset_type !== 'credit_alphanum4') continue;
      if (payment.asset_code !== 'USDC') continue;
      if (payment.asset_issuer !== this.stellarUsdcIssuer) continue;

      // Only inbound — skip outgoing transfers from this address
      if (payment.to !== publicKey) continue;

      results.push({
        txHash:      payment.transaction_hash,
        from:        payment.from,
        to:          payment.to,
        amount:      payment.amount,
        assetCode:   payment.asset_code,
        assetIssuer: payment.asset_issuer,
        createdAt:   payment.created_at,
        pagingToken: payment.paging_token,
      });
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Device signature verification — ECDSA P-256 (secp256r1)
  //
  // Public key formats accepted:
  //   • PEM  ("-----BEGIN PUBLIC KEY-----…")
  //   • Base64 / base64url DER SubjectPublicKeyInfo
  //
  // Signature format: base64 or base64url DER-encoded ECDSA signature
  // Message: the plain-text string that was signed on the client
  // ─────────────────────────────────────────────────────────────────────────

  verifyDeviceSignature(opts: {
    publicKey: string;
    signature: string;
    message:   string;
  }): boolean {
    try {
      const { publicKey: rawKey, signature, message } = opts;

      // Build a KeyObject from either PEM or base64-encoded DER
      let keyObject: crypto.KeyObject;
      if (rawKey.startsWith('-----BEGIN')) {
        keyObject = crypto.createPublicKey(rawKey);
      } else {
        // Normalise base64url → standard base64 before decoding
        const b64 = rawKey.replace(/-/g, '+').replace(/_/g, '/');
        keyObject = crypto.createPublicKey({
          key:    Buffer.from(b64, 'base64'),
          format: 'der',
          type:   'spki',
        });
      }

      const verify = crypto.createVerify('SHA256');
      verify.update(message);

      // Normalise signature: base64url → base64
      const sigB64  = signature.replace(/-/g, '+').replace(/_/g, '/');
      const sigBuf  = Buffer.from(sigB64, 'base64');

      return verify.verify(keyObject, sigBuf);
    } catch (err) {
      this.logger.warn(
        `verifyDeviceSignature failed: ${(err as Error).message}`,
      );
      return false;
    }
  }
}