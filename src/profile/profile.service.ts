// src/profile/profile.service.ts
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { normalizeUsername } from '../auth/utils/identity-normalization.util';
import { UpdateProfileDto } from './dto';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async update(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<
    Omit<
      User,
      | 'passwordHash'
      | 'pinHash'
      | 'stellarSecretEnc'
      | 'normalizeIdentityFields'
    >
  > {
    const normalizedUsername = dto.username
      ? normalizeUsername(dto.username)
      : undefined;

    if (normalizedUsername) {
      const existing = await this.userRepo.findOne({
        where: { username: normalizedUsername },
      });
      if (existing && existing.id !== userId)
        throw new ConflictException('Username already taken');
    }
    if (dto.phone) {
      const existing = await this.userRepo.findOne({
        where: { phone: dto.phone },
      });
      if (existing && existing.id !== userId)
        throw new ConflictException('Phone already registered');
    }

    await this.userRepo.update(
      { id: userId },
      {
        ...dto,
        ...(normalizedUsername ? { username: normalizedUsername } : {}),
      },
    );
    const updated = await this.userRepo.findOne({ where: { id: userId } });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, pinHash, stellarSecretEnc, ...safe } =
      updated as User & {
        passwordHash: string;
        pinHash: string;
        stellarSecretEnc: string;
      };
    return safe;
  }
}
