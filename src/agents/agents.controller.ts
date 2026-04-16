import { Controller, Get, Post, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AgentsService } from './agents.service';

@ApiTags('Agents')
@ApiBearerAuth('access-token')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('analyze-registration')
  @ApiOperation({ summary: 'Analyze registration for fraud' })
  @ApiResponse({ status: 200, description: 'Analysis queued' })
  analyzeRegistration(@Body() body: { userId: string; ipAddress: string }) {
    return this.agentsService.analyzeRegistrationFraud(
      body.userId,
      body.ipAddress,
    );
  }

  @Post('analyze-share')
  @ApiOperation({ summary: 'Analyze share event for fraud' })
  @ApiResponse({ status: 200, description: 'Analysis queued' })
  analyzeShare(@Body() body: { shareEventId: string }) {
    return this.agentsService.analyzeShareFraud(body.shareEventId);
  }

  @Get('fraud-stats')
  @ApiOperation({ summary: 'Get fraud detection statistics' })
  @ApiResponse({ status: 200, description: 'Fraud statistics' })
  getFraudStats() {
    return this.agentsService.getFraudStats();
  }
}
