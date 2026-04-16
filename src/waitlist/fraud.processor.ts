import { Job } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { ShareEvent } from './entities/share-event.entity';
import { AgentsService } from 'src/agents/agents.service';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
@Processor('fraud-detection')
export class FraudProcessor extends WorkerHost {
  private readonly logger = new Logger(FraudProcessor.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ShareEvent)
    private readonly shareRepo: Repository<ShareEvent>,
    private readonly agentsService: AgentsService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { type, userId, ipAddress, shareEventId } = job.data as {
      type: string;
      userId: string;
      ipAddress: string;
      shareEventId: string;
    };

    try {
      if (type === 'check-registration') {
        await this.checkRegistrationFraud(userId, ipAddress);
      } else if (type === 'check-share') {
        await this.checkShareFraud(shareEventId);
      }

      this.logger.log(`Fraud check completed for ${type}`);
    } catch (error) {
      this.logger.error(`Fraud check failed for job ${job.id}`, error);
      throw error;
    }
  }

  private async checkRegistrationFraud(userId: string, ipAddress: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    // Queue fraud analysis
    await this.agentsService.analyzeRegistrationFraud(userId, ipAddress);

    // For immediate response, we could do basic checks here
    // But the detailed analysis happens in the agents processor
  }

  private async checkShareFraud(shareEventId: string) {
    // Queue fraud analysis
    await this.agentsService.analyzeShareFraud(shareEventId);

    // The actual fraud detection and user flagging happens in the agents processor
  }
}
