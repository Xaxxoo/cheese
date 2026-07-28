// src/admin-auth/admin-treasury.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import { User } from '../auth/entities/user.entity';

export interface EvmTreasuryTokenBalance {
  symbol: string;
  tokenAddress: string;
  decimals: number;
  payments: string;
  fees: string;
  total: string;
  vaultBalance: string;
  signerBalance: string;
  accountingOk: boolean;
  error?: string;
}

export interface EvmTreasuryChainBalance {
  chainId: number;
  chainName: string;
  displayName: string;
  factoryAddress: string | null;
  vaultAddress: string | null;
  backendSigner: string | null;
  nativeBalance: string | null;
  withdrawalAddress: string | null;
  tokens: EvmTreasuryTokenBalance[];
  errors: string[];
}

const EVM_TREASURY_ENV_PREFIXES: Record<string, string> = {
  amoy: 'AMOY',
  arbitrum: 'ARBITRUM',
  base: 'BASE',
  celo: 'CELO',
  polygon: 'POLYGON',
  ethereum: 'ETHEREUM',
};

@Injectable()
export class AdminTreasuryService {
  private readonly logger = new Logger(AdminTreasuryService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
  ) {}

  private getTreasuryEnvPrefix(chainName: string): string {
    return EVM_TREASURY_ENV_PREFIXES[chainName] ??
      chainName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  }

  private getVaultAddress(chainName: string): string {
    const prefix = this.getTreasuryEnvPrefix(chainName);
    return this.config.get<string>(`${prefix}_VAULT_ADDRESS`) ?? '';
  }

  private getWithdrawalDestination(chainName: string, required: true): string;
  private getWithdrawalDestination(chainName: string, required?: false): string | null;
  private getWithdrawalDestination(
    chainName: string,
    required = false,
  ): string | null {
    const prefix = this.getTreasuryEnvPrefix(chainName);
    const addr =
      this.config.get<string>(`${prefix}_WITHDRAWAL_ADDRESS`) ??
      this.config.get<string>('EVM_WITHDRAWAL_ADDRESS') ??
      '';

    if (!addr) {
      if (!required) return null;
      throw new ServiceUnavailableException(
        `${prefix}_WITHDRAWAL_ADDRESS or EVM_WITHDRAWAL_ADDRESS not configured — set it to a cold wallet or multisig address`,
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      if (!required) return null;
      throw new ServiceUnavailableException(
        `${prefix}_WITHDRAWAL_ADDRESS/EVM_WITHDRAWAL_ADDRESS is invalid — expected a 0x address`,
      );
    }

    return addr;
  }

  // ── GET /admin/treasury ──────────────────────────────────────────────────
  async getBalance(): Promise<{
    address:        string;
    balanceUsdc:    string;
    contractUsdc?:  string;
    contractAdmin?: string;
    evmVault?:      {
      vaultAddress: string;
      payments:     string;
      fees:         string;
      total:        string;
      chainId:      number;
    };
    evmVaults?:     EvmTreasuryChainBalance[];
  }> {
    const address = this.blockchain.platformPublicKey;
    if (!address) {
      throw new ServiceUnavailableException(
        'Platform wallet not initialised — check STELLAR_PLATFORM_SECRET_KEY',
      );
    }
    const balanceUsdc = await this.blockchain.getStellarUsdcBalance(address);

    let contractUsdc: string | undefined;
    let contractAdmin: string | undefined;
    if (this.blockchain.isSorobanReady) {
      try {
        contractUsdc = await this.blockchain.getSorobanContractUsdcBalance();
      } catch (err) {
        this.logger.warn(`Contract USDC balance fetch failed: ${(err as Error).message}`);
      }
      try {
        contractAdmin = await this.blockchain.getContractAdmin();
      } catch (err) {
        this.logger.warn(`getContractAdmin failed: ${(err as Error).message}`);
      }
    }

    const evmVaults = await this.getEvmVaultBalances();
    const legacyVault = evmVaults
      .flatMap((chain) =>
        chain.tokens.map((token) => ({
          vaultAddress: chain.vaultAddress ?? '',
          payments: token.payments,
          fees:     token.fees,
          total:    token.total,
          chainId:  chain.chainId,
        })),
      )
      .find((entry) => entry.vaultAddress);

    return {
      address,
      balanceUsdc,
      ...(contractUsdc  !== undefined ? { contractUsdc  } : {}),
      ...(contractAdmin !== undefined ? { contractAdmin } : {}),
      ...(legacyVault ? { evmVault: legacyVault } : {}),
      ...(evmVaults.length > 0 ? { evmVaults } : {}),
    };
  }

  private async getEvmVaultBalances(): Promise<EvmTreasuryChainBalance[]> {
    if (!this.blockchain.isEvmReady) return [];

    const depositChains = this.blockchain.getConfiguredEvmDepositChains();
    const configuredChains = depositChains.length > 0
      ? depositChains
      : this.blockchain.getConfiguredEvmChainsWithTokens();

    const results: EvmTreasuryChainBalance[] = [];

    for (const chain of configuredChains) {
      const vaultAddress = this.getVaultAddress(chain.name);
      const errors: string[] = [];
      let factoryAddress: string | null = null;
      let backendSigner: string | null = null;
      let nativeBalance: string | null = null;

      try {
        factoryAddress = this.blockchain.getEvmContractAddress(chain.chainId);
      } catch (err) {
        errors.push((err as Error).message);
      }

      try {
        backendSigner = this.blockchain.getEvmSignerAddress(chain.chainId);
      } catch (err) {
        errors.push((err as Error).message);
      }

      try {
        nativeBalance = await this.blockchain.getEvmNativeBalance(chain.chainId);
      } catch (err) {
        errors.push((err as Error).message);
      }

      if (!vaultAddress) {
        errors.push(`${this.getTreasuryEnvPrefix(chain.name)}_VAULT_ADDRESS not configured`);
      }

      const tokens: EvmTreasuryTokenBalance[] = [];
      for (const token of chain.tokens) {
        const summary: EvmTreasuryTokenBalance = {
          symbol:       token.symbol,
          tokenAddress: token.address,
          decimals:     token.decimals,
          payments:     '0.00000000',
          fees:         '0.00000000',
          total:        '0.00000000',
          vaultBalance: '0.00000000',
          signerBalance: '0.00000000',
          accountingOk: false,
        };

        // Fetch signer token balance (funds collected from bank transfer split-debits)
        if (backendSigner) {
          try {
            summary.signerBalance = await this.blockchain.getErc20Balance(
              backendSigner,
              token.address,
              chain.chainId,
            );
          } catch (err) {
            this.logger.warn(
              `EVM signer balance fetch failed [chain=${chain.name}] [token=${token.symbol}]: ${(err as Error).message}`,
            );
          }
        }

        if (!vaultAddress) {
          summary.error = 'Vault address not configured for this chain';
          tokens.push(summary);
          continue;
        }

        try {
          const [accounting, vaultBalance] = await Promise.all([
            this.blockchain.getVaultBalance(
              vaultAddress,
              token.address,
              chain.chainId,
            ),
            this.blockchain.getErc20Balance(
              vaultAddress,
              token.address,
              chain.chainId,
            ),
          ]);
          summary.payments = accounting.payments;
          summary.fees = accounting.fees;
          summary.total = accounting.total;
          summary.vaultBalance = vaultBalance;
          summary.accountingOk =
            parseFloat(vaultBalance) + 0.000001 >= parseFloat(accounting.total);
        } catch (err) {
          const message = (err as Error).message;
          summary.error = message;
          errors.push(`${token.symbol}: ${message}`);
          this.logger.warn(
            `EVM vault balance fetch failed [chain=${chain.name}] [token=${token.symbol}]: ${message}`,
          );
        }

        tokens.push(summary);
      }

      results.push({
        chainId: chain.chainId,
        chainName: chain.name,
        displayName: chain.displayName,
        factoryAddress,
        vaultAddress: vaultAddress || null,
        backendSigner,
        nativeBalance,
        withdrawalAddress: this.getWithdrawalDestination(chain.name),
        tokens,
        errors,
      });
    }

    return results;
  }

  // ── GET /admin/treasury/lookup-addresses ─────────────────────────────────
  async lookupAddresses(
    addresses: string[],
  ): Promise<{ address: string; username: string | null; id: string | null }[]> {
    if (!addresses.length) return [];
    const users = await this.userRepo.find({
      where: addresses.map((a) => ({ stellarPublicKey: a })),
      select: ['id', 'username', 'stellarPublicKey'],
    });
    const map = new Map(users.map((u) => [u.stellarPublicKey, u]));
    return addresses.map((a) => ({
      address: a,
      username: map.get(a)?.username ?? null,
      id: map.get(a)?.id ?? null,
    }));
  }

  // ── POST /admin/treasury/transfer ────────────────────────────────────────
  async transfer(
    toAddress: string,
    amountUsdc: string,
  ): Promise<{ txHash: string; toAddress: string; amountUsdc: string }> {
    const platformAddress = this.blockchain.platformPublicKey;
    if (!platformAddress) {
      throw new ServiceUnavailableException(
        'Platform wallet not initialised — check STELLAR_PLATFORM_SECRET_KEY',
      );
    }

    const amount = parseFloat(amountUsdc);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    // Safety — do not allow sending to the platform wallet itself
    if (toAddress === platformAddress) {
      throw new BadRequestException(
        'Destination address cannot be the platform wallet itself',
      );
    }

    const balance = parseFloat(
      await this.blockchain.getStellarUsdcBalance(platformAddress),
    );
    if (amount > balance) {
      throw new BadRequestException(
        `Insufficient platform balance. Available: ${balance.toFixed(6)} USDC`,
      );
    }

    this.logger.log(
      `Treasury transfer initiated: ${amountUsdc} USDC → ${toAddress}`,
    );

    const txHash = await this.blockchain.platformDepositUsdc(toAddress, amountUsdc);

    this.logger.log(
      `Treasury transfer settled [hash=${txHash}] [to=${toAddress}] [amount=${amountUsdc}]`,
    );

    return { txHash, toAddress, amountUsdc };
  }

  // ── POST /admin/treasury/evm-withdraw ────────────────────────────────────
  async evmWithdraw(opts: {
    chainId: number;
    tokenAddress: string;
  }): Promise<{
    txHash: string;
    toAddress: string;
    chainId: number;
    tokenAddress: string;
    tokenSymbol: string;
  }> {
    if (!this.blockchain.isEvmReady) {
      throw new ServiceUnavailableException(
        'EVM not configured — check {CHAIN}_RPC_URL, {CHAIN}_FACTORY_ADDRESS, and token env vars',
      );
    }

    const depositChains = this.blockchain.getConfiguredEvmDepositChains();
    const configuredChains = depositChains.length > 0
      ? depositChains
      : this.blockchain.getConfiguredEvmChainsWithTokens();
    const chain = configuredChains.find((item) => item.chainId === opts.chainId);
    if (!chain) {
      throw new BadRequestException(`Chain ${opts.chainId} is not configured for EVM treasury withdrawals`);
    }

    const token = chain.tokens.find(
      (item) => item.address.toLowerCase() === opts.tokenAddress.toLowerCase(),
    );
    if (!token) {
      throw new BadRequestException('Token is not configured for this chain');
    }

    const vaultAddress = this.getVaultAddress(chain.name);
    if (!vaultAddress) {
      throw new ServiceUnavailableException(
        `${this.getTreasuryEnvPrefix(chain.name)}_VAULT_ADDRESS not configured`,
      );
    }

    const toAddress = this.getWithdrawalDestination(chain.name, true);
    this.logger.log(
      `evmWithdraw initiated [chain=${chain.name}] [token=${token.symbol}] [to=${toAddress}]`,
    );
    const txHash = await this.blockchain.withdrawFromVault(
      vaultAddress,
      toAddress,
      token.address,
      chain.chainId,
    );
    this.logger.log(
      `evmWithdraw settled [chain=${chain.name}] [token=${token.symbol}] [txHash=${txHash}] [to=${toAddress}]`,
    );
    return {
      txHash,
      toAddress,
      chainId: chain.chainId,
      tokenAddress: token.address,
      tokenSymbol: token.symbol,
    };
  }

  // ── POST /admin/treasury/recover-contract-balance ─────────────────────────
  // Calls withdraw(username, amount, stellarAddress) on the Soroban contract,
  // which debits the user's internal balance and sends USDC back to their
  // Stellar address. Use when a user's USDC is stuck in the contract
  // (e.g. after migration) but is not showing on their balance.
  async recoverContractBalance(opts: {
    userId: string;
    amountUsdc: string;
  }): Promise<{ txHash: string; amountUsdc: string; toAddress: string; contractBalanceBefore: string }> {
    const user = await this.userRepo.findOne({ where: { id: opts.userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.username) throw new BadRequestException('User has no username — cannot query contract');
    if (!user.stellarPublicKey) throw new BadRequestException('User has no Stellar wallet');

    if (!this.blockchain.isSorobanReady) {
      throw new ServiceUnavailableException(
        'Soroban not configured — check STELLAR_CONTRACT_ID, STELLAR_SOROBAN_RPC_URL',
      );
    }

    // Always use the actual Soroban contract balance — ignore the requested
    // amount so the caller never has to know which portion is on-contract vs
    // in the classic Stellar wallet.
    const contractBalanceBefore = await this.blockchain.getSorobanBalance(user.username);
    const contractAmount = parseFloat(contractBalanceBefore);

    if (contractAmount <= 0) {
      throw new BadRequestException(
        `@${user.username} has no balance in the Soroban contract. ` +
        `Their funds may still be in their classic Stellar wallet and cannot be swept via this method.`,
      );
    }

    this.logger.log(
      `recoverContractBalance initiated [user=@${user.username}] [amount=${contractBalanceBefore}] [to=${user.stellarPublicKey}]`,
    );

    // contract withdraw(username, amount, to_address) — debits internal balance
    // and executes usdc.transfer(contract → user's Stellar address) atomically.
    const result = await this.blockchain.sendViaContract({
      fromUsername: user.username,
      fromPublicKey: user.stellarPublicKey,
      amountUsdc: contractBalanceBefore,
      toPublicKey: user.stellarPublicKey,
    });

    this.logger.log(
      `recoverContractBalance settled [user=@${user.username}] [hash=${result.txHash}] [to=${user.stellarPublicKey}]`,
    );

    return {
      txHash: result.txHash,
      amountUsdc: contractBalanceBefore,
      toAddress: user.stellarPublicKey,
      contractBalanceBefore,
    };
  }

  // ── POST /admin/treasury/sweep-classic-wallet ─────────────────────────────
  // Sweeps USDC directly from a user's classic Stellar wallet (Horizon path)
  // to the platform treasury. Used when the user's balance was never migrated
  // into the Soroban contract and recover-contract-balance returns 0.
  async sweepClassicWallet(opts: {
    userId: string;
  }): Promise<{ txHash: string; amountUsdc: string; fromAddress: string }> {
    const user = await this.userRepo.findOne({ where: { id: opts.userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.stellarPublicKey) throw new BadRequestException('User has no Stellar wallet');
    if (!user.stellarSecretEnc) throw new BadRequestException('User has no encrypted Stellar secret on record');

    const platformAddress = this.blockchain.platformPublicKey;
    if (!platformAddress) {
      throw new ServiceUnavailableException('Stellar not configured — check STELLAR_PLATFORM_SECRET_KEY');
    }

    const horizonBalance = await this.blockchain.getStellarUsdcBalance(user.stellarPublicKey);
    if (parseFloat(horizonBalance) <= 0) {
      throw new BadRequestException(
        `@${user.username ?? opts.userId} has no USDC in their classic Stellar wallet.`,
      );
    }

    this.logger.log(
      `sweepClassicWallet initiated [user=@${user.username}] [amount=${horizonBalance}] [to=${platformAddress}]`,
    );

    const result = await this.blockchain.sendStellarUsdc({
      fromSecretEnc: user.stellarSecretEnc,
      toPublicKey:   platformAddress,
      amountUsdc:    horizonBalance,
    });

    this.logger.log(
      `sweepClassicWallet settled [user=@${user.username}] [hash=${result.txHash}]`,
    );

    return {
      txHash:      result.txHash,
      amountUsdc:  horizonBalance,
      fromAddress: user.stellarPublicKey,
    };
  }

  // ── POST /admin/treasury/restore-contract-balances ───────────────────────
  // Restores expired persistent Balance(username) ledger entries so that the
  // drain can withdraw them.  Pass the usernames whose entries have expired
  // (getSorobanBalance returns 0 / MissingValue but TotalBalance still counts
  // their amounts).  After this succeeds, trigger contract-drain-all again.
  async restoreContractBalances(usernames: string[]): Promise<{
    restored: { username: string; txHash: string | null }[];
    skipped:  string[];
  }> {
    if (!this.blockchain.isSorobanReady) {
      throw new ServiceUnavailableException(
        'Soroban not configured — check STELLAR_CONTRACT_ID, STELLAR_SOROBAN_RPC_URL',
      );
    }
    if (!usernames.length) {
      return { restored: [], skipped: [] };
    }

    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const restored: { username: string; txHash: string | null }[] = [];
    const skipped: string[] = [];

    for (const username of usernames) {
      this.logger.log(`restoreContractBalances: attempting @${username}`);
      const txHash = await this.blockchain.restoreContractBalance(username);
      if (txHash !== null) {
        restored.push({ username, txHash });
      } else {
        skipped.push(username);
      }
      await sleep(2000); // avoid RPC rate limits
    }

    this.logger.log(
      `restoreContractBalances done: restored=${restored.length} skipped=${skipped.length}`,
    );
    return { restored, skipped };
  }

  // ── POST /admin/treasury/contract-drain-all ───────────────────────────────
  // Moves ALL USDC out of the Soroban contract back to the platform treasury:
  //   Step 1 — For every registered user with internal balance > 0,
  //             calls withdraw(username, balance, platform) to debit their
  //             tracked balance and send USDC to the treasury.
  //   Step 2 — Calls sweep_excess(platform) to recover any untracked USDC
  //             (e.g. from users whose migration Phase 3 failed).
  // After this call the contract holds 0 USDC. Users will see $0 until
  // the platform manually credits them.
  async contractDrainAll(): Promise<{
    trackedWithdrawn:  { username: string; amountUsdc: string; txHash: string }[];
    excessSweepTxHash: string | null;
    excessSweepError:  string | null;
    totalTrackedUsdc:  string;
  }> {
    if (!this.blockchain.isSorobanReady) {
      throw new ServiceUnavailableException(
        'Soroban not configured — check STELLAR_CONTRACT_ID, STELLAR_SOROBAN_RPC_URL',
      );
    }

    const platformAddress = this.blockchain.platformPublicKey;
    if (!platformAddress) {
      throw new ServiceUnavailableException('Platform wallet not initialised');
    }

    // Load all users who have a Stellar wallet and a username
    const users = await this.userRepo.find({
      where: { stellarPublicKey: Not(IsNull()), username: Not(IsNull()) },
      select: ['id', 'username', 'stellarPublicKey'],
    });

    const trackedWithdrawn: { username: string; amountUsdc: string; txHash: string }[] = [];
    let totalTracked = 0;

    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    // Step 1: Drain tracked balances for all registered users
    for (const user of users) {
      if (!user.username || !user.stellarPublicKey) continue;

      const balance = await this.blockchain.getSorobanBalance(user.username);
      const balanceNum = parseFloat(balance);
      if (balanceNum <= 0) continue;

      try {
        const result = await this.blockchain.sendViaContract({
          fromUsername:  user.username,
          fromPublicKey: user.stellarPublicKey,
          amountUsdc:    balance,
          toPublicKey:   platformAddress,
        });
        trackedWithdrawn.push({ username: user.username, amountUsdc: balance, txHash: result.txHash });
        totalTracked += balanceNum;
        this.logger.log(
          `contractDrainAll: withdrew ${balance} USDC from @${user.username} → treasury [hash=${result.txHash}]`,
        );
      } catch (err) {
        this.logger.error(
          `contractDrainAll: failed to withdraw from @${user.username}: ${(err as Error).message}`,
        );
      }

      // Avoid hammering the Soroban RPC and hitting 429 rate limits
      await sleep(1500);
    }

    // Step 2: Sweep any remaining untracked excess to treasury
    let excessSweepTxHash: string | null = null;
    let excessSweepError: string | null = null;
    try {
      excessSweepTxHash = await this.blockchain.sweepContractExcess();
      this.logger.log(`contractDrainAll: sweep_excess → treasury [hash=${excessSweepTxHash}]`);
    } catch (err) {
      excessSweepError = (err as Error).message;
      this.logger.error(`contractDrainAll: sweep_excess failed: ${excessSweepError}`);
    }

    return {
      trackedWithdrawn,
      excessSweepTxHash,
      excessSweepError,
      totalTrackedUsdc: totalTracked.toFixed(7),
    };
  }
}
