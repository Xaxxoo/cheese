// src/config/data-source.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

export default new DataSource({
  type: process.env.NODE_ENV === 'production' ? 'postgres' : 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'cheese',
  password: process.env.DB_PASS || 'cheese',
  database: process.env.DB_NAME || 'cheese_wallet',
  entities: [join(__dirname, '../**/*.entity.{ts,js}')],
  migrations: [join(__dirname, '../migrations/*.{ts,js}')],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
});
