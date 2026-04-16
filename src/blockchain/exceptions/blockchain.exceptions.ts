import { HttpException, HttpStatus } from '@nestjs/common';

export class WalletNotFoundException extends HttpException {
  constructor(identifier: string) {
    super(
      {
        code: 'WALLET_NOT_FOUND',
        message: `Blockchain wallet not found: ${identifier}`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class WalletNotReadyException extends HttpException {
  constructor(userId: string) {
    super(
      {
        code: 'WALLET_NOT_READY',
        message: `Wallet for user ${userId} is not yet active. On-chain creation is pending. Retry shortly.`,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class WalletAlreadyExistsException extends HttpException {
  constructor(userId: string) {
    super(
      {
        code: 'WALLET_ALREADY_EXISTS',
        message: `A wallet already exists for user: ${userId}`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class WalletSuspendedException extends HttpException {
  constructor(walletAddress: string) {
    super(
      {
        code: 'WALLET_SUSPENDED',
        message: `Wallet ${walletAddress} is suspended and cannot process transactions`,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class InsufficientOnChainBalanceException extends HttpException {
  constructor(required: string, available: string, token: string) {
    super(
      {
        code: 'INSUFFICIENT_ON_CHAIN_BALANCE',
        message: `Insufficient ${token} balance on-chain. Required: ${required}, Available: ${available}`,
        required,
        available,
        token,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class ContractCallException extends HttpException {
  constructor(operation: string, reason: string) {
    super(
      {
        code: 'CONTRACT_CALL_FAILED',
        message: `Smart contract call failed during '${operation}': ${reason}`,
        operation,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}

export class UsernameNotRegisteredOnChainException extends HttpException {
  constructor(username: string) {
    super(
      {
        code: 'USERNAME_NOT_REGISTERED_ON_CHAIN',
        message: `Username @${username} is not registered on-chain`,
        username,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class BlockchainTransactionNotFoundException extends HttpException {
  constructor(identifier: string) {
    super(
      {
        code: 'BLOCKCHAIN_TX_NOT_FOUND',
        message: `Blockchain transaction not found: ${identifier}`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class WalletCreationMaxRetriesException extends HttpException {
  constructor(userId: string, retries: number) {
    super(
      {
        code: 'WALLET_CREATION_MAX_RETRIES',
        message: `Wallet creation for user ${userId} failed after ${retries} attempts. Manual intervention required.`,
        retries,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
