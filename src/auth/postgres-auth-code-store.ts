import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { AuthCodeStore } from './auth-code-store';
import { AuthCodeRecordEntity } from '../database/entities/auth-code-record.entity';

const TTL_MS = 5 * 60 * 1000;

@Injectable()
export class PostgresAuthCodeStore extends AuthCodeStore {
  constructor(
    @InjectRepository(AuthCodeRecordEntity)
    private readonly repo: Repository<AuthCodeRecordEntity>,
  ) {
    super();
  }

  async create(teamsUserId: string): Promise<string> {
    const code = randomBytes(32).toString('hex');
    await this.repo.save({
      code,
      teamsUserId,
      expiresAt: String(Date.now() + TTL_MS),
    });
    return code;
  }

  async consume(code: string): Promise<string | null> {
    const record = await this.repo.findOne({ where: { code } });
    if (!record) return null;
    await this.repo.delete({ code });
    if (Number(record.expiresAt) <= Date.now()) return null;
    return record.teamsUserId;
  }
}
