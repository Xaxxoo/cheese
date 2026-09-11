// src/scripts/send-birthday.ts
// Usage: npx ts-node -r tsconfig-paths/register src/scripts/send-birthday.ts <username>

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { EmailService } from '../email/email.service';
import type { Repository } from 'typeorm';

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage: npx ts-node -r tsconfig-paths/register src/scripts/send-birthday.ts <username>');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
  const emailService = app.get(EmailService);

  const user = await userRepo.findOne({
    where: { username: username.replace(/^@/, ''), isActive: true },
  });

  if (!user) {
    console.error(`User @${username} not found or inactive.`);
    await app.close();
    process.exit(1);
  }

  console.log(`Sending birthday email to @${user.username} (${user.email})...`);

  await emailService.sendHappyBirthday({
    to: user.email,
    fullName: user.fullName || user.username,
    username: user.username,
  });

  console.log('Birthday email sent!');
  await app.close();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
