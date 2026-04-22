/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-plus-operands, @typescript-eslint/no-unsafe-enum-comparison */
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
  txHash: string;
  from: string;
  to: string;
  amount: string;
  assetCode: string;
  assetIssuer: string;
  createdAt: string;
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
  private evmProvider: ethers.JsonRpcProvider;
  private evmSigner: ethers.Wallet;
  /** UserWalletFactory — the single deployed contract */
  private evmFactory: ethers.Contract;
  /** USDC ERC-20 — used by the platform signer to credit user wallets */
  private evmUsdcContract: ethers.Contract;
  private evmUsdcAddress: string;
  private tokenDecimals: number;
  private evmReady = false;

  // ── Stellar ────────────────────────────────────────────────────────────
  private stellarServer: StellarSdk.Horizon.Server;
  private stellarNetwork: string;
  private stellarPlatformKeypair: StellarSdk.Keypair;
  private stellarUsdcIssuer: string;
  private stellarReady = false;

  // ── Soroban (contract layer) ───────────────────────────────────────────
  private sorobanRpc: StellarSdk.rpc.Server;
  private sorobanContractId: string;
  private sorobanReady = false;

  // ── Encryption ─────────────────────────────────────────────────────────
  private encryptionKey: Buffer;
  private encryptionReady = false;

  // ─────────────────────────────────────────────────────────────────────────
  // Contract ABIs — matched exactly to the deployed Solidity sources
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * UserWalletFactory — the single contract at WALLET_CONTRACT_ADDRESS.
   * Handles wallet creation, P2P transfers and username resolution.
   */
  private readonly FACTORY_ABI = [
    // ── Mutating ────────────────────────────────────────────────────────
    'function createWallet(string calldata userId, string calldata username) external returns (address wallet)',
    'function transferByUsername(string calldata fromUsername, string calldata toUsername, uint256 amount) external',
    // ── Views ────────────────────────────────────────────────────────────
    'function getWallet(string calldata userId) external view returns (address)',
    'function getWalletByUsername(string calldata username) external view returns (address)',
    'function hasWallet(string calldata userId) external view returns (bool)',
    'function isUsernameTaken(string calldata username) external view returns (bool)',
    'function getWalletAtIndex(uint256 index) external view returns (address)',
    'function totalWallets() external view returns (uint256)',
    // ── Events ───────────────────────────────────────────────────────────
    'event WalletCreated(bytes32 indexed userIdHash, bytes32 indexed usernameHash, address indexed wallet, string username, uint256 timestamp)',
    'event Transfer(address indexed fromWallet, address indexed toWallet, string fromUsername, string toUsername, uint256 amount, uint256 timestamp)',
  ];

  /**
   * UserWallet — individual contract deployed per user.
   * Address read from the blockchain_wallets table (wallet_address column).
   */
  private readonly USER_WALLET_ABI = [
    // ── Views ────────────────────────────────────────────────────────────
    'function getBalance() external view returns (uint256)',
    // ── Mutating ────────────────────────────────────────────────────────
    'function withdraw(uint256 amount, address recipient) external',
    'function transferToUser(address recipientWallet, uint256 amount) external',
    'function transferToVault(uint256 paymentAmount) external returns (uint256 totalAmount)',
    'function setOwner(address newOwner) external',
    'function emergencyWithdraw() external',
    // ── Events ───────────────────────────────────────────────────────────
    'event Withdrawal(address indexed recipient, uint256 amount, uint256 timestamp)',
    'event TransferredToUser(address indexed recipient, uint256 amount, uint256 timestamp)',
    'event TransferredToVault(uint256 paymentAmount, uint256 feeAmount, uint256 totalAmount, uint256 timestamp)',
    'event OwnerUpdated(address indexed oldOwner, address indexed newOwner)',
  ];

  /**
   * Minimal ERC-20 ABI — used to send USDC from the platform signer to a
   * UserWallet address (the "credit" path, i.e. fiat → on-chain deposit).
   */
  private readonly ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
  ];

  constructor(private readonly config: ConfigService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Initialisation — each chain boots independently, app never crashes on
  // missing / placeholder config
  // ─────────────────────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    const rpcUrl = this.config.get<string>('BLOCKCHAIN_RPC_URL');
    const privateKey = this.config.get<string>('PLATFORM_WALLET_PRIVATE_KEY');
    const factoryAddr = this.config.get<string>('WALLET_CONTRACT_ADDRESS');
    const usdcAddr = this.config.get<string>('USDC_CONTRACT_ADDRESS');

    const stellarSecret = this.config.get<string>(
      'STELLAR_PLATFORM_SECRET_KEY',
    );
    const horizonUrl = this.config.get<string>('STELLAR_HORIZON_URL');
    const encKey = this.config.get<string>('SECRET_ENCRYPTION_KEY');

    // EVM — all four vars required
    if (rpcUrl && privateKey && factoryAddr && usdcAddr) {
      try {
        await this.initEvm(rpcUrl, privateKey, factoryAddr, usdcAddr);
        this.evmReady = true;
      } catch (err) {
        this.logger.error(`EVM init failed: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn(
        'EVM not configured — blockchain EVM features disabled ' +
          '(need BLOCKCHAIN_RPC_URL, PLATFORM_WALLET_PRIVATE_KEY, WALLET_CONTRACT_ADDRESS, USDC_CONTRACT_ADDRESS)',
      );
    }

    // Stellar — init if secret looks like a real Stellar secret key (starts with S)
    const trimmedSecret = stellarSecret?.trim();
    if (horizonUrl && trimmedSecret && trimmedSecret.startsWith('S')) {
      try {
        await this.initStellar(horizonUrl, trimmedSecret);
        this.stellarReady = true;
      } catch (err) {
        this.logger.error(
          `Stellar init failed: ${(err as Error).message ?? String(err)}`,
        );
      }
    } else {
      this.logger.warn('Stellar not configured — Stellar features disabled');
    }

    // Soroban — init if contract ID and RPC URL are present
    const contractId    = this.config.get<string>('STELLAR_CONTRACT_ID');
    const sorobanRpcUrl = this.config.get<string>('STELLAR_SOROBAN_RPC_URL');

    if (contractId && sorobanRpcUrl) {
      try {
        this.initSoroban(sorobanRpcUrl, contractId);
        this.sorobanReady = true;
      } catch (err) {
        this.logger.error(`Soroban init failed: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn(
        'Soroban not configured — contract features disabled ' +
          '(need STELLAR_CONTRACT_ID, STELLAR_SOROBAN_RPC_URL)',
      );
    }

    // Encryption — init if key is exactly 64 hex chars
    if (encKey && encKey.length === 64) {
      try {
        this.initEncryption(encKey);
        this.encryptionReady = true;
      } catch (err) {
        this.logger.error(`Encryption init failed: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn(
        `SECRET_ENCRYPTION_KEY not configured (length=${encKey?.length ?? 0}) — encryption disabled`,
      );
    }

    this.logger.log(
      `Blockchain init — stellar=${this.stellarReady} soroban=${this.sorobanReady} evm=${this.evmReady} enc=${this.encryptionReady}`,
    );
  }

  private async initEvm(
    rpcUrl: string,
    privateKey: string,
    factoryAddress: string,
    usdcAddress: string,
  ): Promise<void> {
    this.evmProvider = new ethers.JsonRpcProvider(rpcUrl);
    this.evmSigner = new ethers.Wallet(privateKey, this.evmProvider);
    this.evmFactory = new ethers.Contract(
      factoryAddress,
      this.FACTORY_ABI,
      this.evmSigner,
    );
    this.evmUsdcAddress = usdcAddress;
    this.evmUsdcContract = new ethers.Contract(
      usdcAddress,
      this.ERC20_ABI,
      this.evmSigner,
    );

    // USDC is always 6 decimals on every EVM chain — verify to be safe
    this.tokenDecimals = Number(await this.evmUsdcContract.decimals());

    const network = await this.evmProvider.getNetwork();
    this.logger.log(
      `EVM ready [chain=${network.name}] [chainId=${network.chainId}]` +
        ` [factory=${factoryAddress}] [usdc=${usdcAddress}]` +
        ` [signer=${this.evmSigner.address}] [tokenDecimals=${this.tokenDecimals}]`,
    );
  }

  private async initStellar(
    horizonUrl: string,
    secretKey: string,
  ): Promise<void> {
    const network = this.config.get<string>('STELLAR_NETWORK', 'mainnet');
    const isMainnet = network === 'mainnet';

    this.stellarServer = new StellarSdk.Horizon.Server(horizonUrl);
    this.stellarNetwork = isMainnet
      ? StellarSdk.Networks.PUBLIC
      : StellarSdk.Networks.TESTNET;
    this.stellarPlatformKeypair = StellarSdk.Keypair.fromSecret(secretKey);
    this.stellarUsdcIssuer = isMainnet
      ? STELLAR_USDC_ISSUERS.mainnet
      : STELLAR_USDC_ISSUERS.testnet;

    // loadAccount is a connectivity/balance check only — don't let it block init
    try {
      const account = await this.stellarServer.loadAccount(
        this.stellarPlatformKeypair.publicKey(),
      );
      const xlmBalance = account.balances.find(
        (b) => b.asset_type === 'native',
      );
      this.logger.log(
        `Stellar ready [network=${network}]` +
          ` [platform=${this.stellarPlatformKeypair.publicKey()}]` +
          ` [xlm=${xlmBalance?.balance ?? '?'}]`,
      );
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      this.logger.warn(
        `Stellar keypair OK but loadAccount failed [network=${network}]` +
          ` [platform=${this.stellarPlatformKeypair.publicKey()}] — ${msg}`,
      );
    }
  }

  private initEncryption(keyHex: string): void {
    this.encryptionKey = Buffer.from(keyHex, 'hex');
    this.logger.log('Encryption ready');
  }

  private initSoroban(rpcUrl: string, contractId: string): void {
    this.sorobanRpc = new StellarSdk.rpc.Server(rpcUrl);
    this.sorobanContractId = contractId;
    this.logger.log(
      `Soroban ready [rpc=${rpcUrl}] [contract=${contractId}]`,
    );
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  private requireEvm(operation: string): void {
    if (!this.evmReady) {
      throw new ContractCallException(
        operation,
        'EVM not initialised — check BLOCKCHAIN_RPC_URL, PLATFORM_WALLET_PRIVATE_KEY, WALLET_CONTRACT_ADDRESS, USDC_CONTRACT_ADDRESS',
      );
    }
  }

  private requireStellar(operation: string): void {
    if (!this.stellarReady) {
      throw new ContractCallException(
        operation,
        'Stellar not initialised — check STELLAR_HORIZON_URL, STELLAR_PLATFORM_SECRET_KEY',
      );
    }
  }

  private requireEncryption(operation: string): void {
    if (!this.encryptionReady) {
      throw new ContractCallException(
        operation,
        'Encryption not initialised — check SECRET_ENCRYPTION_KEY',
      );
    }
  }

  private requireSoroban(operation: string): void {
    if (!this.sorobanReady) {
      throw new ContractCallException(
        operation,
        'Soroban not initialised — check STELLAR_CONTRACT_ID, STELLAR_SOROBAN_RPC_URL',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM — helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Return a UserWallet contract instance connected to the platform signer.
   * Each user has their own deployed UserWallet at `walletAddress`.
   */
  private getUserWallet(walletAddress: string): ethers.Contract {
    return new ethers.Contract(
      walletAddress,
      this.USER_WALLET_ABI,
      this.evmSigner,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM — Wallet creation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Deploy a new UserWallet via the factory and register the username.
   *
   * @param userId    Internal platform user ID (stored hashed on-chain — no PII).
   * @param username  Display @handle. Lowercased before submission.
   */
  async createEvmWallet(
    userId: string,
    username: string,
  ): Promise<EvmWalletCreationResult> {
    this.requireEvm('createEvmWallet');
    this.logger.log(
      `createEvmWallet [userId=${userId}] [username=${username}]`,
    );
    try {
      const tx = await this.evmFactory.createWallet(
        userId,
        username.toLowerCase(),
      );
      const receipt = (await tx.wait(1)) as ethers.TransactionReceipt;
      // WalletCreated(bytes32 userIdHash, bytes32 usernameHash, address wallet, string username, uint256 timestamp)
      const walletAddress = this.parseFactoryEventArg(
        receipt,
        'WalletCreated',
        'wallet',
      );

      this.logger.log(
        `createEvmWallet confirmed [username=${username}]` +
          ` [wallet=${walletAddress}] [txHash=${receipt.hash}]`,
      );

      return {
        walletAddress: ethers.getAddress(walletAddress),
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (err) {
      throw this.wrapError('createEvmWallet', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM — Balance
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Read the USDC balance held inside a UserWallet contract.
   * The UserWallet's getBalance() calls usdc.balanceOf(address(this)) — meaning
   * ANY USDC sent to the wallet address (from any source / chain) is captured.
   */
  async getEvmBalance(walletAddress: string): Promise<string> {
    this.requireEvm('getEvmBalance');
    try {
      const userWallet = this.getUserWallet(walletAddress);
      const raw: bigint = await userWallet.getBalance();
      return this.toHuman(raw);
    } catch (err) {
      throw this.wrapError('getEvmBalance', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM — Debit (withdraw from UserWallet)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Debit USDC from a user's on-chain wallet by calling
   * UserWallet.withdraw(amount, recipient).
   *
   * @param walletAddress   The deployed UserWallet contract address.
   * @param amount          Human-readable USDC amount ("31.25").
   * @param recipientAddress Where to send the USDC (platform collection wallet
   *                        for bank cashouts, or any external address).
   */
  async evmDebit(
    walletAddress: string,
    amount: string,
    recipientAddress: string,
  ): Promise<ContractOperationResult> {
    this.requireEvm('evmDebit');
    const units = this.toUnits(amount);
    this.logger.log(
      `evmDebit [wallet=${walletAddress}] [amount=${amount}] [to=${recipientAddress}]`,
    );
    try {
      const userWallet = this.getUserWallet(walletAddress);
      const tx = await userWallet.withdraw(units, recipientAddress);
      const receipt = (await tx.wait(1)) as ethers.TransactionReceipt;
      const balanceAfter = await this.getEvmBalance(walletAddress);
      this.logger.log(
        `evmDebit confirmed [txHash=${receipt.hash}] [balanceAfter=${balanceAfter}]`,
      );
      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        balanceAfter,
      };
    } catch (err) {
      throw this.wrapError('evmDebit', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM — Credit (send USDC into UserWallet)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Credit USDC into a user's on-chain wallet by sending directly via the
   * USDC ERC-20 contract from the platform signer.
   *
   * The UserWallet holds the USDC balance as usdc.balanceOf(address(this)).
   * There is no explicit "deposit" function — any ERC-20 transfer to the
   * wallet address is immediately reflected in getBalance().
   *
   * @param walletAddress The deployed UserWallet contract address.
   * @param amount        Human-readable USDC amount ("100.00").
   */
  async evmCredit(
    walletAddress: string,
    amount: string,
  ): Promise<ContractOperationResult> {
    this.requireEvm('evmCredit');
    const units = this.toUnits(amount);
    this.logger.log(`evmCredit [wallet=${walletAddress}] [amount=${amount}]`);
    try {
      const tx = await this.evmUsdcContract.transfer(walletAddress, units);
      const receipt = (await tx.wait(1)) as ethers.TransactionReceipt;
      const balanceAfter = await this.getEvmBalance(walletAddress);
      this.logger.log(
        `evmCredit confirmed [txHash=${receipt.hash}] [balanceAfter=${balanceAfter}]`,
      );
      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        balanceAfter,
      };
    } catch (err) {
      throw this.wrapError('evmCredit', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM — P2P Transfer
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Transfer USDC between two users identified by @username via the factory.
   * The factory calls fromWallet.transferToUser(toWallet, amount) atomically.
   *
   * Note: the contract does NOT accept an app reference — idempotency must
   * be enforced at the application layer (blockchain_transactions table).
   */
  async evmTransferByUsername(
    fromUsername: string,
    toUsername: string,
    amount: string,
  ): Promise<ContractOperationResult> {
    this.requireEvm('evmTransferByUsername');
    const units = this.toUnits(amount);
    this.logger.log(
      `evmTransferByUsername [@${fromUsername} → @${toUsername}] [amount=${amount}]`,
    );
    try {
      const tx = await this.evmFactory.transferByUsername(
        fromUsername.toLowerCase(),
        toUsername.toLowerCase(),
        units,
      );
      const receipt = (await tx.wait(1)) as ethers.TransactionReceipt;

      // Fetch sender balance after transfer for the response
      const senderWallet = await this.resolveEvmUsername(fromUsername);
      const balanceAfter = senderWallet
        ? await this.getEvmBalance(senderWallet)
        : '0.00000000';

      this.logger.log(
        `evmTransferByUsername confirmed [txHash=${receipt.hash}] [@${fromUsername} balanceAfter=${balanceAfter}]`,
      );
      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        balanceAfter,
      };
    } catch (err) {
      throw this.wrapError('evmTransferByUsername', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM — Username resolution
  // ─────────────────────────────────────────────────────────────────────────

  async resolveEvmUsername(username: string): Promise<string | null> {
    this.requireEvm('resolveEvmUsername');
    try {
      const address: string = await this.evmFactory.getWalletByUsername(
        username.toLowerCase(),
      );
      const zero = '0x0000000000000000000000000000000000000000';
      return address === zero ? null : ethers.getAddress(address);
    } catch (err) {
      throw this.wrapError('resolveEvmUsername', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM — Owner management (post-KYC user recovery address)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set the recovery address on a UserWallet after the user completes KYC.
   * Calls UserWallet.setOwner(newOwner) as the backend signer.
   */
  async setEvmWalletOwner(
    walletAddress: string,
    ownerAddress: string,
  ): Promise<string> {
    this.requireEvm('setEvmWalletOwner');
    this.logger.log(
      `setEvmWalletOwner [wallet=${walletAddress}] [owner=${ownerAddress}]`,
    );
    try {
      const userWallet = this.getUserWallet(walletAddress);
      const tx = await userWallet.setOwner(ownerAddress);
      const receipt = (await tx.wait(1)) as ethers.TransactionReceipt;
      this.logger.log(`setEvmWalletOwner confirmed [txHash=${receipt.hash}]`);
      return receipt.hash;
    } catch (err) {
      throw this.wrapError('setEvmWalletOwner', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stellar — Wallet creation
  // ─────────────────────────────────────────────────────────────────────────

  async createStellarWallet(): Promise<StellarWalletCreationResult> {
    this.requireStellar('createStellarWallet');
    this.requireEncryption('createStellarWallet');

    const keypair = StellarSdk.Keypair.random();
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
    const platformAccount = await this.stellarServer.loadAccount(
      this.stellarPlatformKeypair.publicKey(),
    );

    const tx = new StellarSdk.TransactionBuilder(platformAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.stellarNetwork,
    })
      .addOperation(
        StellarSdk.Operation.createAccount({
          destination: newPublicKey,
          startingBalance: '1.6',
        }),
      )
      .setTimeout(30)
      .build();

    tx.sign(this.stellarPlatformKeypair);
    const result = await this.stellarServer.submitTransaction(tx);
    this.logger.log(`fundStellarAccount submitted [hash=${result.hash}]`);
  }

  async ensureTrustline(
    keypairOrEnc: StellarSdk.Keypair | string,
  ): Promise<void> {
    this.requireStellar('ensureTrustline');

    const keypair =
      typeof keypairOrEnc === 'string'
        ? StellarSdk.Keypair.fromSecret(this.decryptSecret(keypairOrEnc))
        : keypairOrEnc;

    const publicKey = keypair.publicKey();
    this.logger.log(`ensureTrustline [publicKey=${publicKey}]`);

    const account = await this.stellarServer.loadAccount(publicKey);
    const hasUsdcTrustline = account.balances.some(
      (b) =>
        b.asset_type === 'credit_alphanum4' &&
        b.asset_code === 'USDC' &&
        b.asset_issuer === this.stellarUsdcIssuer,
    );

    if (hasUsdcTrustline) {
      this.logger.debug(
        `ensureTrustline: USDC trustline already exists [publicKey=${publicKey}]`,
      );
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
    this.logger.log(
      `ensureTrustline submitted [hash=${result.hash}] [publicKey=${publicKey}]`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stellar — Balance
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns true if the given Stellar account exists and has an active USDC trustline.
   * Returns false if the account does not exist (404) or has no USDC trustline.
   * Throws for unexpected errors (network, etc.).
   */
  async hasUsdcTrustline(publicKey: string): Promise<boolean> {
    this.requireStellar('hasUsdcTrustline');
    try {
      const account = await this.stellarServer.loadAccount(publicKey);
      return account.balances.some(
        (b) =>
          b.asset_type === 'credit_alphanum4' &&
          (b as StellarSdk.Horizon.HorizonApi.BalanceLine<'credit_alphanum4'>)
            .asset_code === 'USDC' &&
          (b as StellarSdk.Horizon.HorizonApi.BalanceLine<'credit_alphanum4'>)
            .asset_issuer === this.stellarUsdcIssuer,
      );
    } catch (err) {
      // Horizon returns 404 when the account has never been funded
      const anyErr = err as { response?: { status?: number } };
      if (anyErr?.response?.status === 404) return false;
      throw this.wrapError('hasUsdcTrustline', err);
    }
  }

  async getStellarUsdcBalance(publicKey: string): Promise<string> {
    this.requireStellar('getStellarUsdcBalance');
    try {
      const account = await this.stellarServer.loadAccount(publicKey);
      const usdcBalance = account.balances.find(
        (b) =>
          b.asset_type === 'credit_alphanum4' &&
          b.asset_code === 'USDC' &&
          b.asset_issuer === this.stellarUsdcIssuer,
      ) as
        | StellarSdk.Horizon.HorizonApi.BalanceLine<'credit_alphanum4'>
        | undefined;
      return usdcBalance?.balance ?? '0.0000000';
    } catch (err) {
      throw this.wrapError('getStellarUsdcBalance', err);
    }
  }

  async getStellarXlmBalance(publicKey: string): Promise<string> {
    this.requireStellar('getStellarXlmBalance');
    try {
      const account = await this.stellarServer.loadAccount(publicKey);
      const xlm = account.balances.find((b) => b.asset_type === 'native');
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
    const senderKeypair = StellarSdk.Keypair.fromSecret(
      this.decryptSecret(fromSecretEnc),
    );
    const senderPublicKey = senderKeypair.publicKey();
    this.logger.log(
      `sendStellarUsdc [from=${senderPublicKey}] [to=${toPublicKey}] [amount=${amountUsdc}]`,
    );

    try {
      const senderAccount =
        await this.stellarServer.loadAccount(senderPublicKey);
      const usdcAsset = new StellarSdk.Asset('USDC', this.stellarUsdcIssuer);
      const txBuilder = new StellarSdk.TransactionBuilder(senderAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.stellarNetwork,
      }).addOperation(
        StellarSdk.Operation.payment({
          destination: toPublicKey,
          asset: usdcAsset,
          amount: amountUsdc,
        }),
      );

      if (memo) txBuilder.addMemo(StellarSdk.Memo.text(memo.slice(0, 28)));

      const tx = txBuilder.setTimeout(30).build();
      tx.sign(senderKeypair);

      const result = await this.stellarServer.submitTransaction(tx);
      const balanceAfter = await this.getStellarUsdcBalance(senderPublicKey);
      this.logger.log(
        `sendStellarUsdc confirmed [hash=${result.hash}] [balanceAfter=${balanceAfter}]`,
      );
      return { txHash: result.hash, balanceAfter };
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response?.data
      ) {
        const ops = err.response.data?.extras?.result_codes?.operations;
        const msg = ops ? `Stellar op error: ${ops.join(', ')}` : String(err);
        throw new ContractCallException('sendStellarUsdc', msg);
      }
      throw this.wrapError('sendStellarUsdc', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stellar — Platform deposit / withdraw
  // ─────────────────────────────────────────────────────────────────────────

  async platformDepositUsdc(
    toPublicKey: string,
    amountUsdc: string,
  ): Promise<string> {
    this.requireStellar('platformDepositUsdc');
    this.requireEncryption('platformDepositUsdc');
    this.logger.log(
      `platformDepositUsdc [to=${toPublicKey}] [amount=${amountUsdc}]`,
    );
    const result = await this.sendStellarUsdc({
      fromSecretEnc: this.encryptSecret(this.stellarPlatformKeypair.secret()),
      toPublicKey,
      amountUsdc,
      memo: 'Cheese deposit',
    });
    return result.txHash;
  }

  async platformWithdrawUsdc(
    fromSecretEnc: string,
    amountUsdc: string,
    reference: string,
  ): Promise<string> {
    this.requireStellar('platformWithdrawUsdc');
    const keypair = StellarSdk.Keypair.fromSecret(
      this.decryptSecret(fromSecretEnc),
    );
    this.logger.log(
      `platformWithdrawUsdc [from=${keypair.publicKey()}] [amount=${amountUsdc}]`,
    );
    const result = await this.sendStellarUsdc({
      fromSecretEnc,
      toPublicKey: this.stellarPlatformKeypair.publicKey(),
      amountUsdc,
      memo: reference.slice(0, 28),
    });
    return result.txHash;
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
      if (record.type !== 'payment') continue;

      const payment = record as any;

      if (payment.asset_type !== 'credit_alphanum4') continue;
      if (payment.asset_code !== 'USDC') continue;
      if (payment.asset_issuer !== this.stellarUsdcIssuer) continue;
      if (payment.to !== publicKey) continue;

      results.push({
        txHash: payment.transaction_hash,
        from: payment.from,
        to: payment.to,
        amount: payment.amount,
        assetCode: payment.asset_code,
        assetIssuer: payment.asset_issuer,
        createdAt: payment.created_at,
        pagingToken: payment.paging_token,
      });
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Encryption — AES-256-GCM
  // ─────────────────────────────────────────────────────────────────────────

  encryptSecret(secret: string): string {
    this.requireEncryption('encryptSecret');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decryptSecret(encryptedSecret: string): string {
    this.requireEncryption('decryptSecret');
    const [ivHex, authTagHex, ciphertextHex] = encryptedSecret.split(':');
    if (!ivHex || !authTagHex || !ciphertextHex)
      throw new Error('Invalid encrypted secret format');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      iv,
    );
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM public helpers
  // ─────────────────────────────────────────────────────────────────────────

  getEvmSignerAddress(): string {
    this.requireEvm('getEvmSignerAddress');
    return this.evmSigner.address;
  }

  getEvmContractAddress(): string {
    this.requireEvm('getEvmContractAddress');
    return this.evmFactory.target as string;
  }

  getEvmUsdcAddress(): string {
    this.requireEvm('getEvmUsdcAddress');
    return this.evmUsdcAddress;
  }

  getTokenDecimals(): number {
    this.requireEvm('getTokenDecimals');
    return this.tokenDecimals;
  }

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
  // Stellar public helpers
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
  // Device signature verification — ECDSA P-256 (secp256r1)
  // ─────────────────────────────────────────────────────────────────────────

  verifyDeviceSignature(opts: {
    publicKey: string;
    signature: string;
    message: string;
  }): boolean {
    try {
      const { publicKey: rawKey, signature, message } = opts;

      let keyObject: crypto.KeyObject;
      if (rawKey.startsWith('-----BEGIN')) {
        keyObject = crypto.createPublicKey(rawKey);
      } else {
        const b64 = rawKey.replace(/-/g, '+').replace(/_/g, '/');
        keyObject = crypto.createPublicKey({
          key: Buffer.from(b64, 'base64'),
          format: 'der',
          type: 'spki',
        });
      }

      const sigBuf = Buffer.from(
        signature.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      );

      return crypto.verify(
        null,
        Buffer.from(message, 'utf8'),
        { key: keyObject, dsaEncoding: 'der' },
        sigBuf,
      );
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private parseFactoryEventArg(
    receipt: ethers.TransactionReceipt,
    eventName: string,
    argName: string,
  ): string {
    const iface = this.evmFactory.interface;
    const eventTopic = iface.getEvent(eventName)!.topicHash;
    const log = receipt.logs.find((l) => l.topics[0] === eventTopic);
    if (!log)
      throw new ContractCallException(
        eventName,
        `${eventName} event not found in receipt`,
      );
    const parsed = iface.parseLog({ topics: [...log.topics], data: log.data })!;
    return parsed.args[argName] as string;
  }

  private wrapError(operation: string, err: unknown): ContractCallException {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(
      `Blockchain call failed [operation=${operation}]: ${message}`,
    );
    return new ContractCallException(operation, message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Backward-compatible aliases
  // ─────────────────────────────────────────────────────────────────────────

  /** @deprecated use getEvmSignerAddress() */
  getSignerAddress(): string {
    return this.getEvmSignerAddress();
  }

  /** @deprecated use getEvmContractAddress() */
  getContractAddress(): string {
    return this.getEvmContractAddress();
  }

  /** @deprecated use getEvmChainId() */
  async getChainId(): Promise<number> {
    return this.getEvmChainId();
  }

  /**
   * @deprecated use createEvmWallet(userId, username)
   * Note: evmAddress param is ignored — the factory no longer takes an address.
   */
  async createWallet(
    userId: string,
    username: string,
  ): Promise<EvmWalletCreationResult> {
    return this.createEvmWallet(userId, username);
  }

  /** @deprecated use getEvmBalance() */
  async getBalance(walletAddress: string): Promise<string> {
    return this.getEvmBalance(walletAddress);
  }

  /** @deprecated use resolveEvmUsername() */
  async resolveUsername(username: string): Promise<string | null> {
    return this.resolveEvmUsername(username);
  }

  /**
   * @deprecated use evmTransferByUsername()
   * Note: `ref` param is ignored — the contract does not accept a reference.
   */
  async transferByUsername(
    from: string,
    to: string,
    amount: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _ref?: string,
  ): Promise<ContractOperationResult> {
    return this.evmTransferByUsername(from, to, amount);
  }

  /**
   * @deprecated use evmDebit()
   * Defaults recipient to the platform signer address.
   */
  async debit(
    wallet: string,
    amount: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _ref?: string,
  ): Promise<ContractOperationResult> {
    return this.evmDebit(wallet, amount, this.getEvmSignerAddress());
  }

  /** @deprecated use evmCredit() */
  async credit(
    wallet: string,
    amount: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _ref?: string,
  ): Promise<ContractOperationResult> {
    return this.evmCredit(wallet, amount);
  }

  /** @deprecated use getStellarUsdcBalance() */
  async getStellarBalance(publicKey: string): Promise<{ usdc: string }> {
    const usdc = await this.getStellarUsdcBalance(publicKey);
    return { usdc };
  }

  async sendUsdc(opts: {
    fromSecretEnc: string;
    toAddress: string;
    amountUsdc: string;
    memo?: string;
  }): Promise<string> {
    const result = await this.sendStellarUsdc({
      fromSecretEnc: opts.fromSecretEnc,
      toPublicKey: opts.toAddress,
      amountUsdc: opts.amountUsdc,
      memo: opts.memo,
    });
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

  // ─────────────────────────────────────────────────────────────────────────
  // Soroban — contract interaction
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Read the fee_rate view function from the Soroban contract.
   * Expects fee_rate() to return u32 basis points (1 bp = 0.01%).
   * Returns a decimal fraction — e.g. 10 bp → 0.001 (0.1%).
   */
  async getContractFeeRate(): Promise<number> {
    this.requireStellar('getContractFeeRate');
    this.requireSoroban('getContractFeeRate');

    const contract     = new StellarSdk.Contract(this.sorobanContractId);
    const sourceAcct   = await this.sorobanRpc.getAccount(
      this.stellarPlatformKeypair.publicKey(),
    );

    const tx = new StellarSdk.TransactionBuilder(sourceAcct, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.stellarNetwork,
    })
      .addOperation(contract.call('fee_rate'))
      .setTimeout(30)
      .build();

    const sim = await this.sorobanRpc.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      throw new ContractCallException(
        'getContractFeeRate',
        (sim as StellarSdk.rpc.Api.SimulateTransactionErrorResponse).error,
      );
    }

    const success = sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse;
    // fee_rate returns u32 basis points: 10 = 0.1%, 100 = 1%
    const bps = StellarSdk.scValToNative(success.result!.retval) as number;
    return bps / 10_000;
  }

  /**
   * Notify the Soroban contract of an inbound USDC deposit.
   * Calls deposit(recipient: address, amount: i128) signed by the platform keypair.
   * Routing is purely by destination address — memo is never read or used.
   */
  async notifyContractDeposit(
    recipientPublicKey: string,
    amountUsdc: string,
  ): Promise<string> {
    this.requireStellar('notifyContractDeposit');
    this.requireSoroban('notifyContractDeposit');

    const amountStroops = BigInt(
      Math.round(parseFloat(amountUsdc) * 10_000_000),
    );

    const contract    = new StellarSdk.Contract(this.sorobanContractId);
    const platformKey = this.stellarPlatformKeypair.publicKey();
    const platformAcct = await this.sorobanRpc.getAccount(platformKey);

    const rawTx = new StellarSdk.TransactionBuilder(platformAcct, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.stellarNetwork,
    })
      .addOperation(
        contract.call(
          'deposit',
          StellarSdk.nativeToScVal(recipientPublicKey, { type: 'address' }),
          StellarSdk.nativeToScVal(amountStroops, { type: 'i128' }),
        ),
      )
      .setTimeout(30)
      .build();

    const sim = await this.sorobanRpc.simulateTransaction(rawTx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      throw new ContractCallException(
        'notifyContractDeposit',
        (sim as StellarSdk.rpc.Api.SimulateTransactionErrorResponse).error,
      );
    }

    const prepared = StellarSdk.rpc
      .assembleTransaction(
        rawTx,
        sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse,
      )
      .build();
    prepared.sign(this.stellarPlatformKeypair);

    const sendResult = await this.sorobanRpc.sendTransaction(prepared);
    if (sendResult.status === 'ERROR') {
      throw new ContractCallException(
        'notifyContractDeposit',
        `Submit error: ${String(sendResult.errorResult ?? 'unknown')}`,
      );
    }

    let getResult = await this.sorobanRpc.getTransaction(sendResult.hash);
    let attempts  = 0;
    while (
      getResult.status === StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND &&
      attempts < 20
    ) {
      await new Promise((r) => setTimeout(r, 1500));
      getResult = await this.sorobanRpc.getTransaction(sendResult.hash);
      attempts++;
    }

    if (getResult.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new ContractCallException(
        'notifyContractDeposit',
        `Transaction did not confirm: status=${getResult.status}`,
      );
    }

    this.logger.log(
      `notifyContractDeposit confirmed [recipient=${recipientPublicKey}] [amount=${amountUsdc}] [hash=${sendResult.hash}]`,
    );
    return sendResult.hash;
  }

  /**
   * Call transfer(from, to, amount) on the Soroban contract.
   * The amount is fee-inclusive — the contract splits the fee internally.
   * USDC amounts are converted to stroops (7 decimal places on Stellar).
   */
  async sendViaContract(opts: {
    fromSecretEnc: string;
    toPublicKey: string;
    amountUsdc: string;
    memo?: string;
  }): Promise<StellarTransferResult> {
    this.requireStellar('sendViaContract');
    this.requireEncryption('sendViaContract');
    this.requireSoroban('sendViaContract');

    const { fromSecretEnc, toPublicKey, amountUsdc, memo } = opts;
    const senderKeypair   = StellarSdk.Keypair.fromSecret(
      this.decryptSecret(fromSecretEnc),
    );
    const senderPublicKey = senderKeypair.publicKey();
    this.logger.log(
      `sendViaContract [from=${senderPublicKey}] [to=${toPublicKey}] [amount=${amountUsdc}]`,
    );

    const contract = new StellarSdk.Contract(this.sorobanContractId);
    // USDC on Stellar uses 7 decimal places — convert to stroops
    const amountStroops = BigInt(
      Math.round(parseFloat(amountUsdc) * 10_000_000),
    );

    const senderAcct = await this.sorobanRpc.getAccount(senderPublicKey);
    const txBuilder  = new StellarSdk.TransactionBuilder(senderAcct, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.stellarNetwork,
    }).addOperation(
      contract.call(
        'transfer',
        StellarSdk.nativeToScVal(senderPublicKey, { type: 'address' }),
        StellarSdk.nativeToScVal(toPublicKey,     { type: 'address' }),
        StellarSdk.nativeToScVal(amountStroops,   { type: 'i128' }),
      ),
    );

    if (memo) txBuilder.addMemo(StellarSdk.Memo.text(memo.slice(0, 28)));
    const rawTx = txBuilder.setTimeout(30).build();

    // Simulate to get the ledger footprint
    const sim = await this.sorobanRpc.simulateTransaction(rawTx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      throw new ContractCallException(
        'sendViaContract',
        (sim as StellarSdk.rpc.Api.SimulateTransactionErrorResponse).error,
      );
    }

    // Assemble (injects footprint + resource fees), then sign
    const prepared = StellarSdk.rpc
      .assembleTransaction(
        rawTx,
        sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse,
      )
      .build();
    prepared.sign(senderKeypair);

    const sendResult = await this.sorobanRpc.sendTransaction(prepared);
    if (sendResult.status === 'ERROR') {
      throw new ContractCallException(
        'sendViaContract',
        `Submit error: ${String(sendResult.errorResult ?? 'unknown')}`,
      );
    }

    // Poll until the transaction lands in a ledger
    let getResult = await this.sorobanRpc.getTransaction(sendResult.hash);
    let attempts  = 0;
    while (
      getResult.status === StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND &&
      attempts < 20
    ) {
      await new Promise((r) => setTimeout(r, 1500));
      getResult = await this.sorobanRpc.getTransaction(sendResult.hash);
      attempts++;
    }

    if (getResult.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new ContractCallException(
        'sendViaContract',
        `Transaction did not confirm: status=${getResult.status}`,
      );
    }

    const balanceAfter = await this.getStellarUsdcBalance(senderPublicKey);
    this.logger.log(
      `sendViaContract confirmed [hash=${sendResult.hash}] [balanceAfter=${balanceAfter}]`,
    );
    return { txHash: sendResult.hash, balanceAfter };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Ready state — used by schedulers to bail early if chains not configured
  // ─────────────────────────────────────────────────────────────────────────

  get isStellarReady(): boolean {
    return this.stellarReady;
  }

  get isEvmReady(): boolean {
    return this.evmReady;
  }

  get isSorobanReady(): boolean {
    return this.sorobanReady;
  }
}
