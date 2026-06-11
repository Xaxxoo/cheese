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

export interface TotalUsdBalance {
  evmUsdc: string;
  evmUsdt: string;
  stellarUsdc: string;
  total: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// USDC issuers
// ─────────────────────────────────────────────────────────────────────────────

const STELLAR_USDC_ISSUERS = {
  mainnet: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  testnet: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
};

// ─────────────────────────────────────────────────────────────────────────────
// EVM multi-chain support
// ─────────────────────────────────────────────────────────────────────────────

interface EvmChainContext {
  chainId: number;
  name: string;
  provider: ethers.JsonRpcProvider;
  signer: ethers.Wallet;
  factory: ethers.Contract;
  usdcContract: ethers.Contract;
  usdcAddress: string;
  usdtContract: ethers.Contract | null;
  usdtAddress: string | null;
  tokenDecimals: number;
}

const EVM_CHAIN_DEFINITIONS = [
  { chainId: 80002, name: 'amoy',     envPrefix: 'AMOY'     },
  { chainId: 42161, name: 'arbitrum', envPrefix: 'ARBITRUM' },
  { chainId: 8453,  name: 'base',     envPrefix: 'BASE'     },
  { chainId: 42220, name: 'celo',     envPrefix: 'CELO'     },
  { chainId: 137,   name: 'polygon',  envPrefix: 'POLYGON'  },
  { chainId: 56,    name: 'bnb',      envPrefix: 'BNB'      },
  { chainId: 10,    name: 'optimism', envPrefix: 'OPTIMISM' },
  { chainId: 1135,  name: 'lisk',     envPrefix: 'LISK'     },
  { chainId: 1,     name: 'ethereum', envPrefix: 'ETHEREUM' },
] as const;

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);

  // ── EVM ────────────────────────────────────────────────────────────────
  private readonly evmChains = new Map<number, EvmChainContext>();
  private primaryChainId: number;
  private evmReady = false;
  private static readonly TOKEN_DECIMALS = 6;

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
    'function transferByUsername(string calldata fromUsername, string calldata toUsername, uint256 amount, address token) external',
    // ── Views ────────────────────────────────────────────────────────────
    'function getWallet(string calldata userId) external view returns (address)',
    'function getWalletByUsername(string calldata username) external view returns (address)',
    'function hasWallet(string calldata userId) external view returns (bool)',
    'function isUsernameTaken(string calldata username) external view returns (bool)',
    'function getWalletAtIndex(uint256 index) external view returns (address)',
    'function totalWallets() external view returns (uint256)',
    // ── Events ───────────────────────────────────────────────────────────
    'event WalletCreated(bytes32 indexed userIdHash, bytes32 indexed usernameHash, address indexed wallet, string username, uint256 timestamp)',
    'event Transfer(address indexed fromWallet, address indexed toWallet, address indexed token, string fromUsername, string toUsername, uint256 amount, uint256 timestamp)',
  ];

  /**
   * UserWallet — individual contract deployed per user.
   * Address read from the blockchain_wallets table (wallet_address column).
   */
  private readonly USER_WALLET_ABI = [
    // ── Views ────────────────────────────────────────────────────────────
    'function getBalance(address token) external view returns (uint256)',
    'function supportedTokens(address token) external view returns (bool)',
    // ── Mutating ────────────────────────────────────────────────────────
    'function withdraw(address token, uint256 amount, address recipient) external',
    'function transferToUser(address token, address recipientWallet, uint256 amount) external',
    'function transferToVault(address token, uint256 paymentAmount) external returns (uint256 totalAmount)',
    'function addSupportedToken(address token) external',
    'function setOwner(address newOwner) external',
    'function emergencyWithdraw(address token) external',
    // ── Events ───────────────────────────────────────────────────────────
    'event Withdrawal(address indexed token, address indexed recipient, uint256 amount, uint256 timestamp)',
    'event TransferredToUser(address indexed token, address indexed recipient, uint256 amount, uint256 timestamp)',
    'event TransferredToVault(address indexed token, uint256 paymentAmount, uint256 feeAmount, uint256 totalAmount, uint256 timestamp)',
    'event OwnerUpdated(address indexed oldOwner, address indexed newOwner)',
    'event TokenAdded(address indexed token)',
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

  private readonly VAULT_ABI = [
    'function getAvailableWithdrawal(address token) external view returns (uint256 payments, uint256 fees, uint256 total)',
    'function withdrawVaultFunds(address to, address token) external',
  ];

  constructor(private readonly config: ConfigService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Initialisation — each chain boots independently, app never crashes on
  // missing / placeholder config
  // ─────────────────────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    const privateKey = this.config.get<string>('PLATFORM_WALLET_PRIVATE_KEY');

    const stellarSecret = this.config.get<string>(
      'STELLAR_PLATFORM_SECRET_KEY',
    );
    const horizonUrl = this.config.get<string>('STELLAR_HORIZON_URL');
    const encKey = this.config.get<string>('SECRET_ENCRYPTION_KEY');

    // EVM — try per-chain env vars first (new format)
    for (const def of EVM_CHAIN_DEFINITIONS) {
      const rpcUrl = this.config.get<string>(`${def.envPrefix}_RPC_URL`);
      const factoryAddr = this.config.get<string>(`${def.envPrefix}_FACTORY_ADDRESS`);
      const usdcAddr = this.config.get<string>(`${def.envPrefix}_USDC_ADDRESS`);
      const usdtAddr = this.config.get<string>(`${def.envPrefix}_USDT_ADDRESS`) ?? null;

      if (rpcUrl && privateKey && ethers.isAddress(factoryAddr) && ethers.isAddress(usdcAddr)) {
        try {
          const ctx = await this.initEvmChain(def.chainId, def.name, rpcUrl, privateKey, factoryAddr, usdcAddr, usdtAddr && ethers.isAddress(usdtAddr) ? usdtAddr : null);
          this.evmChains.set(def.chainId, ctx);
        } catch (err) {
          this.logger.error(`EVM chain ${def.name} (${def.chainId}) init failed: ${(err as Error).message}`);
        }
      }
    }

    // Backward compat: BLOCKCHAIN_RPC_URL / WALLET_CONTRACT_ADDRESS / USDC_CONTRACT_ADDRESS
    // Used only if no named-chain vars are set at all
    if (this.evmChains.size === 0) {
      const rpcUrl = this.config.get<string>('BLOCKCHAIN_RPC_URL');
      const factoryAddr = this.config.get<string>('WALLET_CONTRACT_ADDRESS');
      const usdcAddr = this.config.get<string>('USDC_CONTRACT_ADDRESS');
      const usdtAddr = this.config.get<string>('USDT_CONTRACT_ADDRESS') ?? null;
      if (rpcUrl && privateKey && ethers.isAddress(factoryAddr) && ethers.isAddress(usdcAddr)) {
        try {
          const tempProvider = new ethers.JsonRpcProvider(rpcUrl);
          const network = await tempProvider.getNetwork();
          const chainId = Number(network.chainId);
          const name = EVM_CHAIN_DEFINITIONS.find(d => d.chainId === chainId)?.name ?? `chain-${chainId}`;
          const ctx = await this.initEvmChain(chainId, name, rpcUrl, privateKey, factoryAddr, usdcAddr, usdtAddr && ethers.isAddress(usdtAddr) ? usdtAddr : null);
          this.evmChains.set(chainId, ctx);
        } catch (err) {
          this.logger.error(`EVM (legacy) init failed: ${(err as Error).message}`);
        }
      }
    }

    // Determine primary chain
    const configuredPrimary = this.config.get<number>('EVM_PRIMARY_CHAIN_ID');
    if (configuredPrimary && this.evmChains.has(Number(configuredPrimary))) {
      this.primaryChainId = Number(configuredPrimary);
    } else if (this.evmChains.size > 0) {
      this.primaryChainId = [...this.evmChains.keys()][0];
    }

    if (this.evmChains.size > 0) {
      this.evmReady = true;
      const names = [...this.evmChains.values()].map(c => c.name).join(', ');
      this.logger.log(`EVM ready [chains=${names}] [primary=${this.primaryChainId}]`);
    } else {
      this.logger.warn('EVM not configured — add {CHAIN}_RPC_URL, {CHAIN}_FACTORY_ADDRESS, {CHAIN}_USDC_ADDRESS per chain');
    }

    // Stellar — init if secret looks like a real Stellar secret key (starts with S)
    const trimmedSecret = stellarSecret?.trim();
    if (horizonUrl && trimmedSecret && trimmedSecret.startsWith('S')) {
      try {
        await this.initStellar(horizonUrl, trimmedSecret);
        this.stellarReady = true;
        // Ensure the platform wallet has a USDC trustline so it can receive
        // USDC from users during bank transfers. Idempotent — skips if already set.
        this.ensureTrustline(this.stellarPlatformKeypair).catch((err: Error) =>
          this.logger.warn(
            `Platform USDC trustline setup failed — bank transfers will not work until resolved: ${err.message}`,
          ),
        );
      } catch (err) {
        this.logger.error(
          `Stellar init failed: ${(err as Error).message ?? String(err)}`,
        );
      }
    } else {
      this.logger.warn('Stellar not configured — Stellar features disabled');
    }

    // Soroban — init if contract ID and RPC URL are present
    const contractId = this.config.get<string>('STELLAR_CONTRACT_ID');
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

  private async initEvmChain(
    chainId: number,
    name: string,
    rpcUrl: string,
    privateKey: string,
    factoryAddress: string,
    usdcAddress: string,
    usdtAddress: string | null,
  ): Promise<EvmChainContext> {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);
    const factory = new ethers.Contract(factoryAddress, this.FACTORY_ABI, signer);
    const usdcContract = new ethers.Contract(usdcAddress, this.ERC20_ABI, signer);
    const usdtContract = usdtAddress
      ? new ethers.Contract(usdtAddress, this.ERC20_ABI, signer)
      : null;
    const tokenDecimals = Number(await usdcContract.decimals());

    this.logger.log(
      `EVM chain ready [${name}/${chainId}] [factory=${factoryAddress}]` +
      ` [usdc=${usdcAddress}] [usdt=${usdtAddress ?? 'none'}] [signer=${signer.address}]`,
    );

    return { chainId, name, provider, signer, factory, usdcContract, usdcAddress, usdtContract, usdtAddress, tokenDecimals };
  }

  /**
   * Return the ERC-20 contract instance for a given token address.
   * Defaults to USDC if no address is provided.
   */
  private getTokenContract(ctx: EvmChainContext, token?: string): ethers.Contract {
    if (!token || token.toLowerCase() === ctx.usdcAddress.toLowerCase()) {
      return ctx.usdcContract;
    }
    if (
      ctx.usdtAddress &&
      token.toLowerCase() === ctx.usdtAddress.toLowerCase()
    ) {
      return ctx.usdtContract!;
    }
    throw new ContractCallException(
      'getTokenContract',
      `Unsupported token address: ${token}. Configure USDT_CONTRACT_ADDRESS or use USDC.`,
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
    this.logger.log(`Soroban ready [rpc=${rpcUrl}] [contract=${contractId}]`);
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  private getChainContext(chainId?: number): EvmChainContext {
    const id = chainId ?? this.primaryChainId;
    const ctx = this.evmChains.get(id);
    if (!ctx) {
      throw new ContractCallException('getChainContext', `Chain ${id} not configured`);
    }
    return ctx;
  }

  private requireEvm(operation: string, chainId?: number): void {
    if (!this.evmReady) {
      throw new ContractCallException(
        operation,
        'No EVM chains configured — add {CHAIN}_RPC_URL, {CHAIN}_FACTORY_ADDRESS, {CHAIN}_USDC_ADDRESS per chain',
      );
    }
    if (chainId !== undefined && !this.evmChains.has(chainId)) {
      throw new ContractCallException(operation, `Chain ${chainId} not configured — check {CHAIN}_RPC_URL env vars`);
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

  /**
   * Load a Stellar account for use as a Soroban transaction source.
   * Falls back to Horizon when the Soroban RPC can't find the account
   * (transient RPC sync issues).
   */
  private async getSorobanAccount(publicKey: string): Promise<StellarSdk.Account> {
    try {
      return await this.sorobanRpc.getAccount(publicKey);
    } catch {
      const horizonAcct = await this.stellarServer.loadAccount(publicKey);
      return new StellarSdk.Account(publicKey, horizonAcct.sequenceNumber());
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM — helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Return a UserWallet contract instance connected to the platform signer.
   * Each user has their own deployed UserWallet at `walletAddress`.
   */
  private getUserWallet(walletAddress: string, ctx: EvmChainContext): ethers.Contract {
    return new ethers.Contract(
      walletAddress,
      this.USER_WALLET_ABI,
      ctx.signer,
    );
  }

  /** The USDC token address for the given chain (defaults to primary chain). */
  getEvmUsdcAddress(chainId?: number): string {
    this.requireEvm('getEvmUsdcAddress', chainId);
    return this.getChainContext(chainId).usdcAddress;
  }

  /** The USDT token address for the given chain, or null if not configured. */
  getEvmUsdtAddress(chainId?: number): string | null {
    if (!this.evmReady) return null;
    return this.getChainContext(chainId).usdtAddress;
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
    chainId?: number,
  ): Promise<EvmWalletCreationResult> {
    this.requireEvm('createEvmWallet', chainId);
    const ctx = this.getChainContext(chainId);
    this.logger.log(
      `createEvmWallet [userId=${userId}] [username=${username}] [chain=${ctx.name}]`,
    );
    try {
      const tx = await ctx.factory.createWallet(
        userId,
        username.toLowerCase(),
      );
      const receipt = (await tx.wait(1)) as ethers.TransactionReceipt;
      // WalletCreated(bytes32 userIdHash, bytes32 usernameHash, address wallet, string username, uint256 timestamp)
      const walletAddress = this.parseFactoryEventArg(
        receipt,
        ctx,
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
   * Read the token balance held inside a UserWallet contract.
   * Defaults to USDC if no token address is provided.
   *
   * @param walletAddress  The deployed UserWallet contract address.
   * @param token          ERC-20 token address (USDC or USDT). Defaults to USDC.
   */
  async getEvmBalance(walletAddress: string, token?: string, chainId?: number): Promise<string> {
    this.requireEvm('getEvmBalance', chainId);
    const ctx = this.getChainContext(chainId);
    const tokenAddress = token ?? ctx.usdcAddress;
    try {
      const userWallet = this.getUserWallet(walletAddress, ctx);
      const raw: bigint = await userWallet.getBalance(tokenAddress);
      return this.toHuman(raw);
    } catch (err) {
      throw this.wrapError('getEvmBalance', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM — Deposit event scanning
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Scan eth_getLogs for ERC-20 Transfer events directed at any of toAddresses.
   * One RPC call covers all wallet addresses on the chain.
   *
   * @param chainId       EVM chain to query.
   * @param tokenAddress  ERC-20 contract address (USDC or USDT).
   * @param toAddresses   Array of wallet addresses to match as recipients.
   * @param fromBlock     First block to scan (inclusive).
   * @param toBlock       Last block to scan (inclusive).
   */
  async getEvmDepositEvents(
    chainId: number,
    tokenAddress: string,
    toAddresses: string[],
    fromBlock: number,
    toBlock: number,
  ): Promise<Array<{ from: string; to: string; amount: string; txHash: string; blockNumber: number }>> {
    this.requireEvm('getEvmDepositEvents', chainId);
    const ctx = this.getChainContext(chainId);

    // keccak256("Transfer(address,address,uint256)")
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    // Pad each recipient address to 32 bytes for the indexed `to` filter
    const toTopics = toAddresses.map(addr =>
      ethers.zeroPadValue(ethers.getAddress(addr).toLowerCase(), 32),
    );

    const logs = await ctx.provider.getLogs({
      address: tokenAddress,
      fromBlock,
      toBlock,
      topics: [transferTopic, null, toTopics.length === 1 ? toTopics[0] : toTopics],
    });

    const iface = new ethers.Interface([
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    ]);

    return logs.map(log => {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      return {
        from: parsed!.args.from as string,
        to: parsed!.args.to as string,
        amount: this.toHuman(parsed!.args.value as bigint),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM — Debit (withdraw from UserWallet)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Debit tokens from a user's on-chain wallet by calling
   * UserWallet.withdraw(token, amount, recipient).
   *
   * @param walletAddress    The deployed UserWallet contract address.
   * @param amount           Human-readable amount ("31.25").
   * @param recipientAddress Where to send tokens (platform collection wallet
   *                         for bank cashouts, or any external address).
   * @param token            ERC-20 token address. Defaults to USDC.
   */
  async evmDebit(
    walletAddress: string,
    amount: string,
    recipientAddress: string,
    token?: string,
    chainId?: number,
  ): Promise<ContractOperationResult> {
    this.requireEvm('evmDebit', chainId);
    const ctx = this.getChainContext(chainId);
    const tokenAddress = token ?? ctx.usdcAddress;
    const units = this.toUnits(amount);
    this.logger.log(
      `evmDebit [wallet=${walletAddress}] [amount=${amount}] [to=${recipientAddress}] [token=${tokenAddress}]`,
    );
    try {
      const userWallet = this.getUserWallet(walletAddress, ctx);
      const tx = await userWallet.withdraw(
        tokenAddress,
        units,
        recipientAddress,
      );
      const receipt = (await tx.wait(1)) as ethers.TransactionReceipt;
      const balanceAfter = await this.getEvmBalance(
        walletAddress,
        tokenAddress,
        chainId,
      );
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
   * Credit tokens into a user's on-chain wallet by sending directly via the
   * token ERC-20 contract from the platform signer.
   *
   * The UserWallet holds the balance as token.balanceOf(address(this)).
   * There is no explicit "deposit" function — any ERC-20 transfer to the
   * wallet address is immediately reflected in getBalance(token).
   *
   * @param walletAddress  The deployed UserWallet contract address.
   * @param amount         Human-readable amount ("100.00").
   * @param token          ERC-20 token address. Defaults to USDC.
   */
  async evmCredit(
    walletAddress: string,
    amount: string,
    token?: string,
    chainId?: number,
  ): Promise<ContractOperationResult> {
    this.requireEvm('evmCredit', chainId);
    const ctx = this.getChainContext(chainId);
    const tokenAddress = token ?? ctx.usdcAddress;
    const tokenContract = this.getTokenContract(ctx, tokenAddress);
    const units = this.toUnits(amount);
    this.logger.log(
      `evmCredit [wallet=${walletAddress}] [amount=${amount}] [token=${tokenAddress}]`,
    );
    try {
      const tx = await tokenContract.transfer(walletAddress, units);
      const receipt = (await tx.wait(1)) as ethers.TransactionReceipt;
      const balanceAfter = await this.getEvmBalance(
        walletAddress,
        tokenAddress,
        chainId,
      );
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
   * Transfer tokens between two users identified by @username via the factory.
   * The factory calls fromWallet.transferToUser(token, toWallet, amount) atomically.
   *
   * Note: the contract does NOT accept an app reference — idempotency must
   * be enforced at the application layer (blockchain_transactions table).
   *
   * @param fromUsername  Sender's @handle
   * @param toUsername    Recipient's @handle
   * @param amount        Human-readable amount
   * @param token         ERC-20 token address. Defaults to USDC.
   */
  async evmTransferByUsername(
    fromUsername: string,
    toUsername: string,
    amount: string,
    token?: string,
    chainId?: number,
  ): Promise<ContractOperationResult> {
    this.requireEvm('evmTransferByUsername', chainId);
    const ctx = this.getChainContext(chainId);
    const tokenAddress = token ?? ctx.usdcAddress;
    const units = this.toUnits(amount);
    this.logger.log(
      `evmTransferByUsername [@${fromUsername} → @${toUsername}] [amount=${amount}] [token=${tokenAddress}]`,
    );
    try {
      const tx = await ctx.factory.transferByUsername(
        fromUsername.toLowerCase(),
        toUsername.toLowerCase(),
        units,
        tokenAddress,
      );
      const receipt = (await tx.wait(1)) as ethers.TransactionReceipt;

      // Fetch sender balance after transfer for the response
      const senderWallet = await this.resolveEvmUsername(fromUsername, chainId);
      const balanceAfter = senderWallet
        ? await this.getEvmBalance(senderWallet, tokenAddress, chainId)
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

  async resolveEvmUsername(username: string, chainId?: number): Promise<string | null> {
    this.requireEvm('resolveEvmUsername', chainId);
    const ctx = this.getChainContext(chainId);
    try {
      const address: string = await ctx.factory.getWalletByUsername(
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
    chainId?: number,
  ): Promise<string> {
    this.requireEvm('setEvmWalletOwner', chainId);
    const ctx = this.getChainContext(chainId);
    this.logger.log(
      `setEvmWalletOwner [wallet=${walletAddress}] [owner=${ownerAddress}]`,
    );
    try {
      const userWallet = this.getUserWallet(walletAddress, ctx);
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

  /**
   * Phase 1 of two-phase Stellar provisioning.
   * Generates a keypair and encrypts the secret — no network calls, no XLM spent.
   * Persist the returned values to the DB before calling activateStellarAccount().
   */
  generateStellarKeypair(): { publicKey: string; secretKeyEnc: string } {
    this.requireEncryption('generateStellarKeypair');
    const keypair = StellarSdk.Keypair.random();
    const secretKeyEnc = this.encryptSecret(keypair.secret());
    return { publicKey: keypair.publicKey(), secretKeyEnc };
  }

  /**
   * Phase 2 of two-phase Stellar provisioning.
   * Funds the account (if not already on-chain) and establishes the USDC trustline.
   * Only call this after the keypair has been persisted to the DB.
   * Idempotent: safe to call on an already-funded account.
   */
  async activateStellarAccount(secretKeyEnc: string): Promise<void> {
    this.requireStellar('activateStellarAccount');
    this.requireEncryption('activateStellarAccount');
    const keypair = StellarSdk.Keypair.fromSecret(
      this.decryptSecret(secretKeyEnc),
    );
    const publicKey = keypair.publicKey();

    // Check if the account already exists on-chain before spending XLM
    let accountExists = false;
    try {
      await this.stellarServer.loadAccount(publicKey);
      accountExists = true;
    } catch (err) {
      const anyErr = err as { response?: { status?: number } };
      if (anyErr?.response?.status !== 404) {
        throw this.wrapError('activateStellarAccount', err);
      }
      // 404 → not yet funded, proceed below
    }

    if (!accountExists) {
      await this.fundStellarAccount(publicKey);
    }
    await this.ensureTrustline(keypair);
    this.logger.log(`activateStellarAccount complete [publicKey=${publicKey}]`);
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
          b.asset_code === 'USDC' &&
          b.asset_issuer === this.stellarUsdcIssuer,
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
      const anyErr = err as { response?: { status?: number } };
      if (anyErr?.response?.status === 404) return '0.0000000';
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
  // Combined balance
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Return the total USD-stablecoin balance across all rails for one user.
   *
   * Fetches EVM USDC, EVM USDT, and Stellar USDC in parallel.
   * If a rail is not initialised it contributes 0.00 rather than throwing.
   * All values are normalised to 2 decimal places.
   *
   * @param evmWalletAddress   UserWallet contract address on EVM.
   * @param stellarPublicKey   User's Stellar public key.
   */
  async getTotalUsdBalance(
    evmWalletAddress: string,
    stellarPublicKey: string,
    chainId?: number,
  ): Promise<TotalUsdBalance> {
    const zero = '0.00000000';

    const primaryCtx = this.evmReady ? this.getChainContext(chainId) : null;

    const [evmUsdc, evmUsdt, stellarUsdc] = await Promise.all([
      primaryCtx
        ? this.getEvmBalance(evmWalletAddress, primaryCtx.usdcAddress, chainId)
        : Promise.resolve(zero),
      primaryCtx && primaryCtx.usdtAddress
        ? this.getEvmBalance(evmWalletAddress, primaryCtx.usdtAddress, chainId)
        : Promise.resolve(zero),
      this.stellarReady
        ? this.getStellarUsdcBalance(stellarPublicKey)
        : Promise.resolve(zero),
    ]);

    const total = (
      parseFloat(evmUsdc) +
      parseFloat(evmUsdt) +
      parseFloat(stellarUsdc)
    ).toFixed(2);

    return {
      evmUsdc: parseFloat(evmUsdc).toFixed(2),
      evmUsdt: parseFloat(evmUsdt).toFixed(2),
      stellarUsdc: parseFloat(stellarUsdc).toFixed(2),
      total,
    };
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
  ): Promise<{ payments: StellarPayment[]; nextCursor: string | null }> {
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
    // Track the last raw paging token across ALL record types, not just USDC
    // inbound ones.  Without this, a page of 50 non-USDC operations (XLM
    // payments, path payments, etc.) would return an empty payments array and
    // leave the cursor stuck at the same position forever, permanently hiding
    // any USDC deposit that arrives after those records.
    let nextCursor: string | null = null;

    for (const record of response.records) {
      nextCursor = (record as any).paging_token as string;

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

    return { payments: results, nextCursor };
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

  getEvmSignerAddress(chainId?: number): string {
    this.requireEvm('getEvmSignerAddress', chainId);
    return this.getChainContext(chainId).signer.address;
  }

  getEvmContractAddress(chainId?: number): string {
    this.requireEvm('getEvmContractAddress', chainId);
    return this.getChainContext(chainId).factory.target as string;
  }

  getTokenDecimals(chainId?: number): number {
    this.requireEvm('getTokenDecimals', chainId);
    return this.getChainContext(chainId).tokenDecimals;
  }

  async getEvmChainId(): Promise<number> {
    this.requireEvm('getEvmChainId');
    return this.primaryChainId;
  }

  toUnits(amount: string): bigint {
    return ethers.parseUnits(amount, BlockchainService.TOKEN_DECIMALS);
  }

  toHuman(raw: bigint): string {
    return parseFloat(ethers.formatUnits(raw, BlockchainService.TOKEN_DECIMALS)).toFixed(8);
  }

  /** Returns all configured EVM chains. */
  getConfiguredEvmChains(): Array<{ chainId: number; name: string }> {
    return [...this.evmChains.values()].map(({ chainId, name }) => ({ chainId, name }));
  }

  /** Return the current block number for the given chain. */
  async getEvmBlockNumber(chainId?: number): Promise<number> {
    this.requireEvm('getEvmBlockNumber', chainId);
    const ctx = this.getChainContext(chainId);
    return ctx.provider.getBlockNumber();
  }

  /** Check if a specific chain is ready. */
  isChainReady(chainId: number): boolean {
    return this.evmChains.has(chainId);
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
        'SHA256',
        Buffer.from(message, 'utf8'),
        { key: keyObject, dsaEncoding: 'ieee-p1363' },
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
    ctx: EvmChainContext,
    eventName: string,
    argName: string,
  ): string {
    const iface = ctx.factory.interface;
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

  /**
   * Query a user's internal USDC balance from the Soroban contract by username.
   * Calls balance(username) — read-only simulation, no signing required.
   * Returns a human-readable USDC string (7 decimal places).
   */
  async getSorobanBalance(username: string): Promise<string> {
    this.requireStellar('getSorobanBalance');
    this.requireSoroban('getSorobanBalance');

    const contract = new StellarSdk.Contract(this.sorobanContractId);
    const sourceAcct = await this.getSorobanAccount(
      this.stellarPlatformKeypair.publicKey(),
    );

    const tx = new StellarSdk.TransactionBuilder(sourceAcct, {
      fee: '500000',
      networkPassphrase: this.stellarNetwork,
    })
      .addOperation(
        contract.call(
          'balance',
          StellarSdk.nativeToScVal(username, { type: 'string' }),
        ),
      )
      .setTimeout(300)
      .build();

    const sim = await this.sorobanRpc.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      // MissingValue means the username is not registered in the contract
      // (never registered, or TTL expired). Treat as zero — the caller will
      // fall back to Horizon. Throw for any other simulation error.
      if (sim.error.includes('MissingValue')) return '0.0000000';
      throw new ContractCallException('getSorobanBalance', sim.error);
    }

    const success =
      sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse;
    const balanceStroops = StellarSdk.scValToNative(
      success.result!.retval,
    ) as bigint;
    return (Number(balanceStroops) / 10_000_000).toFixed(7);
  }

  async getContractAdmin(): Promise<string> {
    this.requireStellar('getContractAdmin');
    this.requireSoroban('getContractAdmin');

    const contract  = new StellarSdk.Contract(this.sorobanContractId);
    const sourceAcct = await this.getSorobanAccount(
      this.stellarPlatformKeypair.publicKey(),
    );
    const tx = new StellarSdk.TransactionBuilder(sourceAcct, {
      fee: '500000',
      networkPassphrase: this.stellarNetwork,
    })
      .addOperation(contract.call('get_admin'))
      .setTimeout(300)
      .build();

    const sim = await this.sorobanRpc.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      throw new ContractCallException('getContractAdmin', sim.error);
    }
    const success = sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse;
    const adminVal = StellarSdk.scValToNative(success.result!.retval) as string;
    return adminVal;
  }

  async getContractFeeRate(): Promise<number> {
    this.requireStellar('getContractFeeRate');
    this.requireSoroban('getContractFeeRate');

    const contract = new StellarSdk.Contract(this.sorobanContractId);
    const sourceAcct = await this.getSorobanAccount(
      this.stellarPlatformKeypair.publicKey(),
    );

    const tx = new StellarSdk.TransactionBuilder(sourceAcct, {
      fee: '500000',
      networkPassphrase: this.stellarNetwork,
    })
      .addOperation(contract.call('fee_rate'))
      .setTimeout(300)
      .build();

    const sim = await this.sorobanRpc.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      throw new ContractCallException('getContractFeeRate', sim.error);
    }

    const success =
      sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse;
    // fee_rate returns u32 basis points: 10 = 0.1%, 100 = 1%
    const bps = StellarSdk.scValToNative(success.result!.retval) as number;
    return bps / 10_000;
  }

  /**
   * Notify the Soroban contract of an inbound USDC deposit.
   * Calls deposit_by_address(address, amount, deposit_id) signed by the platform keypair.
   * `depositId` must be unique per deposit (use the Stellar tx hash) to prevent double-credits.
   */
  async notifyContractDeposit(
    recipientPublicKey: string,
    amountUsdc: string,
    depositId: string,
  ): Promise<string> {
    this.requireStellar('notifyContractDeposit');
    this.requireSoroban('notifyContractDeposit');

    const amountStroops = BigInt(
      Math.round(parseFloat(amountUsdc) * 10_000_000),
    );

    const contract = new StellarSdk.Contract(this.sorobanContractId);
    const platformKey = this.stellarPlatformKeypair.publicKey();
    const platformAcct = await this.getSorobanAccount(platformKey);

    const rawTx = new StellarSdk.TransactionBuilder(platformAcct, {
      fee: '500000',
      networkPassphrase: this.stellarNetwork,
    })
      .addOperation(
        contract.call(
          'deposit_by_address',
          StellarSdk.nativeToScVal(recipientPublicKey, { type: 'address' }),
          StellarSdk.nativeToScVal(amountStroops, { type: 'i128' }),
          StellarSdk.nativeToScVal(depositId, { type: 'string' }),
        ),
      )
      .setTimeout(300)
      .build();

    const sim = await this.sorobanRpc.simulateTransaction(rawTx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      throw new ContractCallException('notifyContractDeposit', sim.error);
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
        `Submit error: ${(sendResult.errorResult as any)?.toXDR?.('base64') ?? 'unknown'}`,
      );
    }

    let getResult = await this.sorobanRpc.getTransaction(sendResult.hash);
    let attempts = 0;
    while (
      getResult.status === StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND &&
      attempts < 60
    ) {
      await new Promise((r) => setTimeout(r, 2000));
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
   * Execute a Soroban contract send. Two modes:
   *
   *  P2P (toUsername provided)  — calls transfer(fromUsername, toUsername, amount).
   *    Balances move internally; no USDC leaves the contract except the fee
   *    which goes to the treasury.
   *
   *  External (toPublicKey provided) — calls withdraw(fromUsername, amount, toAddress).
   *    Debits the sender's internal balance and pushes USDC to an external address.
   *
   * All calls are signed by the platform keypair (the contract's admin).
   * The user's PIN has already been verified at the service layer.
   */

  /**
   * Restores an expired persistent Balance(username) entry in the Soroban
   * contract using RestoreFootprintOp.  Must be called before drain/withdraw
   * when getSorobanBalance returns MissingValue for a user whose balance still
   * counts toward TotalBalance.
   *
   * Returns the tx hash on success, or null if the entry does not exist in
   * the archive (never created, or permanently deleted).
   */
  async restoreContractBalance(username: string): Promise<string | null> {
    this.requireStellar('restoreContractBalance');
    this.requireSoroban('restoreContractBalance');

    // DataKey::Balance(username) is stored as ScvVec([Symbol("Balance"), String(username)])
    const balanceKey = StellarSdk.xdr.ScVal.scvVec([
      StellarSdk.xdr.ScVal.scvSymbol('Balance'),
      StellarSdk.xdr.ScVal.scvString(username),
    ]);

    const ledgerKey = StellarSdk.xdr.LedgerKey.contractData(
      new StellarSdk.xdr.LedgerKeyContractData({
        contract: new StellarSdk.Address(this.sorobanContractId).toScAddress(),
        key: balanceKey,
        durability: StellarSdk.xdr.ContractDataDurability.persistent(),
      }),
    );

    const sorobanData = new StellarSdk.SorobanDataBuilder()
      .setReadWrite([ledgerKey])
      .build();

    const platformKey = this.stellarPlatformKeypair.publicKey();
    const sourceAcct  = await this.getSorobanAccount(platformKey);

    const rawTx = new StellarSdk.TransactionBuilder(sourceAcct, {
      fee: '500000',
      networkPassphrase: this.stellarNetwork,
    })
      .addOperation(StellarSdk.Operation.restoreFootprint({}))
      .setSorobanData(sorobanData)
      .setTimeout(300)
      .build();

    const sim = await this.sorobanRpc.simulateTransaction(rawTx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      // Entry not in archive (never existed or permanently deleted) — skip.
      this.logger.warn(
        `restoreContractBalance: no archive entry for @${username}: ${sim.error}`,
      );
      return null;
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
      this.logger.error(
        `restoreContractBalance: submit error for @${username}: ` +
        `${(sendResult.errorResult as any)?.toXDR?.('base64') ?? 'unknown'}`,
      );
      return null;
    }

    let getResult = await this.sorobanRpc.getTransaction(sendResult.hash);
    let attempts = 0;
    while (
      getResult.status === StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND &&
      attempts < 15
    ) {
      await new Promise((r) => setTimeout(r, 2000));
      getResult = await this.sorobanRpc.getTransaction(sendResult.hash);
      attempts++;
    }

    if (getResult.status === StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
      this.logger.warn(`restoreContractBalance: tx still pending for @${username} [hash=${sendResult.hash}]`);
      return sendResult.hash;
    }

    if (getResult.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
      this.logger.error(`restoreContractBalance: tx failed for @${username} [status=${getResult.status}]`);
      return null;
    }

    this.logger.log(`restoreContractBalance: restored @${username} [hash=${sendResult.hash}]`);
    return sendResult.hash;
  }

  /**
   * Calls sweep_excess(recipient: Address) on the Soroban contract.
   * The contract computes excess = actual_usdc_balance - total_internal_balance
   * and transfers it to the given recipient address.
   * Returns the Stellar transaction hash, or null if there is nothing to sweep.
   */
  async sweepContractExcess(): Promise<string | null> {
    this.requireStellar('sweepContractExcess');
    this.requireSoroban('sweepContractExcess');

    const contract    = new StellarSdk.Contract(this.sorobanContractId);
    const platformKey = this.stellarPlatformKeypair.publicKey();

    const sourceAcct = await this.getSorobanAccount(platformKey);

    const rawTx = new StellarSdk.TransactionBuilder(sourceAcct, {
      fee: '500000',
      networkPassphrase: this.stellarNetwork,
    })
      .addOperation(
        contract.call(
          'sweep_excess',
          StellarSdk.nativeToScVal(platformKey, { type: 'address' }),
        ),
      )
      .setTimeout(300)
      .build();

    const sim = await this.sorobanRpc.simulateTransaction(rawTx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      throw new ContractCallException('sweepContractExcess', sim.error);
    }

    const simSuccess = sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse;
    this.logger.log(
      `sweepContractExcess sim OK ` +
      `[authEntries=${simSuccess.result?.auth?.length ?? 0}] ` +
      `[minResourceFee=${simSuccess.minResourceFee}]`,
    );
    if (simSuccess.result?.auth?.length) {
      simSuccess.result.auth.forEach((entry, i) => {
        this.logger.log(`sweepContractExcess auth[${i}]: ${JSON.stringify(entry.toXDR?.('base64'))}`);
      });
    }

    const prepared = StellarSdk.rpc
      .assembleTransaction(
        rawTx,
        simSuccess,
      )
      .build();
    this.logger.log(
      `sweepContractExcess prepared [networkPassphrase="${prepared.networkPassphrase}"] ` +
      `[fee=${prepared.fee}] [sourceAccount=${prepared.source}]`,
    );
    prepared.sign(this.stellarPlatformKeypair);
    this.logger.log(
      `sweepContractExcess txEnvelope: ${prepared.toEnvelope().toXDR('base64')}`,
    );

    const sendResult = await this.sorobanRpc.sendTransaction(prepared);
    if (sendResult.status === 'ERROR') {
      const errorXdr = (sendResult.errorResult as any)?.toXDR?.('base64') ?? 'unknown';
      let errorCode = '';
      try {
        const resultObj = StellarSdk.xdr.TransactionResult.fromXDR(errorXdr, 'base64');
        errorCode = resultObj.result().switch().name;
      } catch (_) { /* ignore */ }
      throw new ContractCallException(
        'sweepContractExcess',
        `Submit error [code=${errorCode}]: ${errorXdr}`,
      );
    }

    // Poll with a short window (15 × 2 s = 30 s) to stay inside Railway's
    // 60-second proxy timeout.  Soroban txs normally confirm in < 10 s.
    let getResult = await this.sorobanRpc.getTransaction(sendResult.hash);
    let attempts = 0;
    while (
      getResult.status === StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND &&
      attempts < 15
    ) {
      await new Promise((r) => setTimeout(r, 2000));
      getResult = await this.sorobanRpc.getTransaction(sendResult.hash);
      attempts++;
    }

    if (getResult.status === StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
      // Still pending — return the hash so the caller can surface it.
      // The tx will confirm on-chain regardless.
      this.logger.warn(`sweepContractExcess still pending after ${attempts} polls [hash=${sendResult.hash}]`);
      return sendResult.hash;
    }

    if (getResult.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new ContractCallException(
        'sweepContractExcess',
        `Transaction did not confirm: status=${getResult.status}`,
      );
    }

    this.logger.log(`sweepContractExcess confirmed [hash=${sendResult.hash}]`);
    return sendResult.hash;
  }

  async sendViaContract(opts: {
    fromUsername: string;
    fromPublicKey: string;
    toUsername?: string;
    toPublicKey?: string;
    amountUsdc: string;
  }): Promise<StellarTransferResult> {
    this.requireStellar('sendViaContract');
    this.requireSoroban('sendViaContract');

    const { fromUsername, fromPublicKey, toUsername, toPublicKey, amountUsdc } = opts;
    const amountStroops = BigInt(
      Math.round(parseFloat(amountUsdc) * 10_000_000),
    );

    const contract = new StellarSdk.Contract(this.sorobanContractId);
    const platformKey = this.stellarPlatformKeypair.publicKey();
    const platformAcct = await this.getSorobanAccount(platformKey);

    let operation: StellarSdk.xdr.Operation;
    if (toUsername) {
      // Internal P2P transfer between two registered users
      this.logger.log(
        `sendViaContract transfer [from=${fromUsername}] [to=${toUsername}] [amount=${amountUsdc}]`,
      );
      operation = contract.call(
        'transfer',
        StellarSdk.nativeToScVal(fromUsername, { type: 'string' }),
        StellarSdk.nativeToScVal(toUsername,   { type: 'string' }),
        StellarSdk.nativeToScVal(amountStroops, { type: 'i128' }),
      );
    } else if (toPublicKey) {
      // External withdrawal — contract sends USDC to an outside address
      this.logger.log(
        `sendViaContract withdraw [from=${fromUsername}] [to=${toPublicKey}] [amount=${amountUsdc}]`,
      );
      operation = contract.call(
        'withdraw',
        StellarSdk.nativeToScVal(fromUsername,  { type: 'string'  }),
        StellarSdk.nativeToScVal(amountStroops, { type: 'i128'    }),
        StellarSdk.nativeToScVal(toPublicKey,   { type: 'address' }),
      );
    } else {
      throw new ContractCallException(
        'sendViaContract',
        'Either toUsername or toPublicKey must be provided',
      );
    }

    const rawTx = new StellarSdk.TransactionBuilder(platformAcct, {
      fee: '500000',
      networkPassphrase: this.stellarNetwork,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    // Simulate to get the ledger footprint + resource fees
    const sim = await this.sorobanRpc.simulateTransaction(rawTx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      throw new ContractCallException('sendViaContract', sim.error);
    }

    // Assemble (injects footprint + resource fees), then sign with platform keypair
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
        'sendViaContract',
        `Submit error: ${(sendResult.errorResult as any)?.toXDR?.('base64') ?? 'unknown'}`,
      );
    }

    // Poll until the transaction lands in a ledger
    let getResult = await this.sorobanRpc.getTransaction(sendResult.hash);
    let attempts = 0;
    while (
      getResult.status === StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND &&
      attempts < 60
    ) {
      await new Promise((r) => setTimeout(r, 2000));
      getResult = await this.sorobanRpc.getTransaction(sendResult.hash);
      attempts++;
    }

    if (getResult.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new ContractCallException(
        'sendViaContract',
        `Transaction did not confirm: status=${getResult.status}`,
      );
    }

    const balanceAfter = await this.getStellarUsdcBalance(fromPublicKey);
    this.logger.log(
      `sendViaContract confirmed [hash=${sendResult.hash}] [balanceAfter=${balanceAfter}]`,
    );
    return { txHash: sendResult.hash, balanceAfter };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVM Vault — CheeseVault contract read/write
  // ─────────────────────────────────────────────────────────────────────────

  async getVaultBalance(
    vaultAddress: string,
    usdcAddress: string,
    chainId: number,
  ): Promise<{ payments: string; fees: string; total: string }> {
    this.requireEvm('getVaultBalance', chainId);
    const ctx = this.getChainContext(chainId);
    try {
      const vault = new ethers.Contract(vaultAddress, this.VAULT_ABI, ctx.provider);
      const [payments, fees, total]: [bigint, bigint, bigint] =
        await vault.getAvailableWithdrawal(usdcAddress);
      return {
        payments: this.toHuman(payments),
        fees:     this.toHuman(fees),
        total:    this.toHuman(total),
      };
    } catch (err) {
      throw this.wrapError('getVaultBalance', err);
    }
  }

  async withdrawFromVault(
    vaultAddress: string,
    toAddress: string,
    usdcAddress: string,
    chainId: number,
  ): Promise<string> {
    this.requireEvm('withdrawFromVault', chainId);
    const ctx = this.getChainContext(chainId);
    this.logger.log(`withdrawFromVault [vault=${vaultAddress}] [to=${toAddress}] [chain=${ctx.name}]`);
    try {
      const vault = new ethers.Contract(vaultAddress, this.VAULT_ABI, ctx.signer);
      const tx = await vault.withdrawVaultFunds(toAddress, usdcAddress);
      const receipt = (await tx.wait(1)) as ethers.TransactionReceipt;
      this.logger.log(`withdrawFromVault confirmed [txHash=${receipt.hash}]`);
      return receipt.hash;
    } catch (err) {
      throw this.wrapError('withdrawFromVault', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // USDC SAC balance — how much USDC the Soroban contract itself holds
  // ─────────────────────────────────────────────────────────────────────────

  async getSorobanContractUsdcBalance(): Promise<string> {
    this.requireStellar('getSorobanContractUsdcBalance');
    this.requireSoroban('getSorobanContractUsdcBalance');

    // Derive the USDC SAC contract ID from the on-chain asset
    const usdcAsset = new StellarSdk.Asset('USDC', this.stellarUsdcIssuer);
    const sacContractId = usdcAsset.contractId(this.stellarNetwork);
    const sacContract = new StellarSdk.Contract(sacContractId);

    const sourceAcct = await this.getSorobanAccount(
      this.stellarPlatformKeypair.publicKey(),
    );

    // Call balance(Address(our_contract)) on the USDC SAC
    const contractAddress = new StellarSdk.Address(this.sorobanContractId).toScVal();

    const tx = new StellarSdk.TransactionBuilder(sourceAcct, {
      fee: '500000',
      networkPassphrase: this.stellarNetwork,
    })
      .addOperation(sacContract.call('balance', contractAddress))
      .setTimeout(300)
      .build();

    const sim = await this.sorobanRpc.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      // Contract holds no USDC (no entry in SAC storage)
      if (sim.error.includes('MissingValue')) return '0.0000000';
      throw new ContractCallException('getSorobanContractUsdcBalance', sim.error);
    }

    const success = sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse;
    const balanceStroops = StellarSdk.scValToNative(success.result!.retval) as bigint;
    return (Number(balanceStroops) / 10_000_000).toFixed(7);
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

  get platformPublicKey(): string | null {
    return this.stellarReady ? this.stellarPlatformKeypair.publicKey() : null;
  }
}
