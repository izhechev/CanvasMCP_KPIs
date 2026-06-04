import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { SessionStore } from './session-store';
import { SessionRecordEntity } from '../database/entities/session-record.entity';

const TTL_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class PostgresSessionStore extends SessionStore {
  constructor(
    @InjectRepository(SessionRecordEntity)
    private readonly repo: Repository<SessionRecordEntity>,
  ) {
    super();
  }

  async create(teamsUserId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.repo.save({
      token,
      teamsUserId,
      expiresAt: String(Date.now() + TTL_MS),
    });
    return token;
  }

  async resolve(token: string): Promise<string | null> {
    const record = await this.repo.findOne({ where: { token } });
    if (!record) return null;
    if (Number(record.expiresAt) <= Date.now()) {
      await this.repo.delete({ token });
      return null;
    }
    return record.teamsUserId;
  }
}
