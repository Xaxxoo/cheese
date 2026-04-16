import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { User } from '../auth/entities/user.entity';
import { ShareEvent } from '../waitlist/entities/share-event.entity';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ShareEvent)
    private readonly shareRepo: Repository<ShareEvent>,
    @Optional()
    @InjectQueue('fraud-analysis')
    private readonly analysisQueue?: Queue,
  ) {}

  async analyzeRegistrationFraud(userId: string, ipAddress: string) {
    // Queue the analysis for async processing
    if (this.analysisQueue) {
      await this.analysisQueue.add(
        'analyze-registration',
        { userId, ipAddress },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      );
    }

    // Return pending result - actual analysis happens async
    return { risk: 'pending', score: 0, reasons: ['Analysis queued'] };
  }

  async analyzeShareFraud(shareEventId: string) {
    // Queue the analysis for async processing
    if (this.analysisQueue) {
      await this.analysisQueue.add(
        'analyze-share',
        { shareEventId },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      );
    }

    // Return pending result - actual analysis happens async
    return { risk: 'pending', score: 0, reasons: ['Analysis queued'] };
  }

  async getFraudStats() {
    const flaggedUsers = await this.userRepo.count({
      where: { isFlagged: true },
    });
    const fraudShares = await this.shareRepo.count({
      where: { isFraud: true },
    });
    const totalUsers = await this.userRepo.count();
    const totalShares = await this.shareRepo.count();

    return {
      flaggedUsers,
      fraudShares,
      flaggedUserPercentage:
        totalUsers > 0 ? ((flaggedUsers / totalUsers) * 100).toFixed(2) : 0,
      fraudSharePercentage:
        totalShares > 0 ? ((fraudShares / totalShares) * 100).toFixed(2) : 0,
    };
  }
}
