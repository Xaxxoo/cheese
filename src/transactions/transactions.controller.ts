// src/transactions/transactions.controller.ts
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@ApiBearerAuth('access-token')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly txService: TransactionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List transactions',
    description:
      "Returns the authenticated user's transaction history in reverse chronological order. Includes send, receive, earn deposit/withdrawal, card spend, and bank transfer types.",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number (1-based, default 1)',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    example: 20,
    description: 'Items per page (default 20, max 100)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Paginated transaction list with total count and page metadata',
  })
  getList(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.txService.getList(user.id, page, pageSize);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get transaction summary stats',
    description: 'Returns lifetime totals for inbound and outbound completed transactions (USDC) and overall transaction count.',
  })
  @ApiResponse({ status: 200, description: '{ totalInUsdc, totalOutUsdc, txCount }' })
  getStats(@CurrentUser() user: User) {
    return this.txService.getStats(user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get transaction by ID',
    description:
      'Returns a single transaction record including Stellar txHash, NGN equivalent at time of transaction, fee breakdown, and current status.',
  })
  @ApiParam({
    name: 'id',
    description: 'Transaction UUID',
    example: 'uuid-v4-transaction-id',
  })
  @ApiResponse({ status: 200, description: 'Full transaction details' })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found or does not belong to user',
  })
  getById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.txService.getById(user.id, id);
  }
}
