// src/cards/cards.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { CardsService } from './cards.service';
import { RevealCvvDto } from './dto';

@ApiTags('Card')
@ApiBearerAuth('access-token')
@Controller('card')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get virtual card',
    description:
      "Returns the user's virtual Mastercard. If no card exists yet, one is automatically provisioned on first call. Card number and CVV are encrypted at rest — only last4 is returned here.",
  })
  @ApiResponse({
    status: 200,
    description:
      'Card details (masked) — includes last4, expiry, status, balance, spend limit',
  })
  getCard(@CurrentUser() user: User) {
    return this.cardsService.getCard(user.id);
  }

  @Post('freeze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Freeze card',
    description:
      'Immediately blocks all transactions on the card. Can be reversed with POST /card/unfreeze.',
  })
  @ApiResponse({ status: 200, description: 'Card frozen successfully' })
  @ApiResponse({
    status: 400,
    description: 'Card is already frozen or terminated',
  })
  freeze(@CurrentUser() user: User) {
    return this.cardsService.freezeCard(user.id);
  }

  @Post('unfreeze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unfreeze card',
    description: 'Re-enables transactions on a previously frozen card.',
  })
  @ApiResponse({ status: 200, description: 'Card unfrozen successfully' })
  @ApiResponse({
    status: 400,
    description: 'Card is not frozen or is terminated',
  })
  unfreeze(@CurrentUser() user: User) {
    return this.cardsService.unfreezeCard(user.id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('cvv')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reveal CVV',
    description:
      'Returns the decrypted CVV with a 60-second expiry timestamp. Requires PIN verification. The CVV is never stored in plaintext — it is decrypted from AES-256-GCM on demand.',
  })
  @ApiResponse({
    status: 200,
    description: 'CVV revealed — includes cvv string and expiresAt timestamp',
  })
  @ApiResponse({ status: 401, description: 'Incorrect PIN' })
  revealCvv(@CurrentUser() user: User, @Body() dto: RevealCvvDto) {
    return this.cardsService.revealCvv(user.id, dto);
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Card transaction history',
    description: 'Returns the last 50 transactions made with the virtual card.',
  })
  @ApiResponse({ status: 200, description: 'Array of card transactions' })
  getTransactions(@CurrentUser() user: User) {
    return this.cardsService.getCardTransactions(user.id);
  }
}
