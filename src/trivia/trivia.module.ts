import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { TriviaController } from './trivia.controller';
import { TriviaService } from './trivia.service';
import { TriviaScore } from './entities/trivia-score.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TriviaScore, User]),
    BlockchainModule,
    TransactionsModule,
    NotificationsModule,
    EmailModule,
  ],
  controllers: [TriviaController],
  providers: [TriviaService],
})
export class TriviaModule {}
