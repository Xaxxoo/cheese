// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get()
  healthCheck() {
    return {
      name: 'Cheese Pay API',
      status: 'online',
      environment: this.config.get<string>('app.nodeEnv'),
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
