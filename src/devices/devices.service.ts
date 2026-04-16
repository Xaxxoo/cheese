// src/devices/devices.service.ts
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterDeviceDto } from './dto';
import { Device } from './entities/device.entity';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
  ) {}

  async register(
    userId: string,
    dto: RegisterDeviceDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _currentDeviceId?: string,
  ): Promise<Device> {
    const existing = await this.deviceRepo.findOne({
      where: { deviceId: dto.deviceId },
    });
    if (existing) {
      if (existing.userId !== userId)
        throw new ConflictException(
          'Device ID already registered to another account',
        );
      // Re-activate if it was the same user
      await this.deviceRepo.update(
        { id: existing.id },
        {
          publicKey: dto.publicKey,
          deviceName: dto.deviceName || existing.deviceName,
          isActive: true,
          lastSeen: new Date(),
        },
      );
      return {
        ...existing,
        publicKey: dto.publicKey,
        deviceName: dto.deviceName || existing.deviceName,
        isActive: true,
        lastSeen: new Date(),
      };
    }

    return this.deviceRepo.save(
      this.deviceRepo.create({
        userId,
        deviceId: dto.deviceId,
        publicKey: dto.publicKey,
        deviceName: dto.deviceName || 'New Device',
        lastSeen: new Date(),
      }),
    );
  }

  async listDevices(userId: string, currentDeviceId?: string) {
    const devices = await this.deviceRepo.find({
      where: { userId, isActive: true },
      order: { lastSeen: 'DESC' },
    });

    return devices.map((d) => ({
      id: d.id,
      deviceName: d.deviceName,
      lastSeen: d.lastSeen,
      location: d.location,
      isCurrent: d.deviceId === currentDeviceId,
    }));
  }

  async revoke(userId: string, deviceId: string): Promise<void> {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    if (device.userId !== userId) throw new ForbiddenException();
    await this.deviceRepo.update({ id: deviceId }, { isActive: false });
  }
}
