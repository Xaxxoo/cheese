import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

interface KycInitiatedEvent {
  kycId: string;
  userId: string;
  verificationId: string;
}

interface KycStatusChangedEvent {
  kycId: string;
  userId: string;
  oldStatus: string;
  newStatus: string;
  verificationId: string;
}

interface KycApprovedEvent {
  kycId: string;
  userId: string;
  level: string;
}

interface KycRejectedEvent {
  kycId: string;
  userId: string;
  reason?: string;
}

interface KycManuallyReviewedEvent {
  kycId: string;
  userId: string;
  status: string;
  reviewedBy: string;
}

@Injectable()
export class KycEventListeners {
  private readonly logger = new Logger(KycEventListeners.name);

  @OnEvent('kyc.initiated')
  handleKycInitiated(payload: KycInitiatedEvent) {
    this.logger.log(
      `KYC initiated for user ${payload.userId}, verification ID: ${payload.verificationId}`,
    );

    // Add your custom logic here:
    // - Send email to user with verification link
    // - Log to analytics
    // - Update user profile status
    // - Notify admin dashboard
  }

  @OnEvent('kyc.status.changed')
  handleKycStatusChanged(payload: KycStatusChangedEvent) {
    this.logger.log(
      `KYC status changed for user ${payload.userId}: ${payload.oldStatus} -> ${payload.newStatus}`,
    );

    // Add your custom logic here:
    // - Send status update email
    // - Update user permissions
    // - Trigger webhook to external systems
    // - Log to analytics
  }

  @OnEvent('kyc.approved')
  handleKycApproved(payload: KycApprovedEvent) {
    this.logger.log(
      `KYC approved for user ${payload.userId} at level ${payload.level}`,
    );

    // Add your custom logic here:
    // - Send congratulations email
    // - Enable full account features
    // - Update user tier/limits
    // - Grant access to premium features
    // - Notify user via push notification
    // - Update compliance records
    // - Trigger onboarding completion flow
  }

  @OnEvent('kyc.rejected')
  handleKycRejected(payload: KycRejectedEvent) {
    this.logger.log(
      `KYC rejected for user ${payload.userId}. Reason: ${payload.reason || 'Not specified'}`,
    );

    // Add your custom logic here:
    // - Send rejection email with instructions
    // - Provide guidance on how to resubmit
    // - Log rejection reasons for analytics
    // - Notify compliance team if fraud suspected
    // - Trigger customer support ticket
  }

  @OnEvent('kyc.manually.reviewed')
  handleManualReview(payload: KycManuallyReviewedEvent) {
    this.logger.log(
      `KYC manually reviewed for user ${payload.userId} by ${payload.reviewedBy}. New status: ${payload.status}`,
    );

    // Add your custom logic here:
    // - Log compliance audit trail
    // - Send notification to user
    // - Update admin dashboard
    // - Generate compliance report
  }

  @OnEvent('kyc.expired')
  handleKycExpired(payload: { kycId: string; userId: string }) {
    this.logger.log(`KYC expired for user ${payload.userId}`);

    // Add your custom logic here:
    // - Send re-verification reminder
    // - Restrict account features
    // - Update user status
    // - Schedule follow-up reminders
  }
}