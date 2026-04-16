// src/config/redis.provider.ts
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const redisUrl = config.get<string>('redis.url');

    const client = redisUrl
      ? new Redis(redisUrl, { lazyConnect: true })
      : new Redis({
          host: config.get('redis.host'),
          port: config.get('redis.port'),
          password: config.get('redis.password') || undefined,
          lazyConnect: true,
        });

    client.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    return client;
  },
};
