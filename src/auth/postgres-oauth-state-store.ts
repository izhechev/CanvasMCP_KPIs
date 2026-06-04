import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { OAuthStatePayload, OAuthStateStore } from './oauth-state-store';
import { OAuthStateRecordEntity } from '../database/entities/oauth-state-record.entity';
import { AppError } from '../common/errors';

const TTL_MS = 10 * 60 * 1000;
const MAX_SIZE = 500;

@Injectable()
export class PostgresOAuthStateStore extends OAuthStateStore {
  constructor(
    @InjectRepository(OAuthStateRecordEntity)
    private readonly repo: Repository<OAuthStateRecordEntity>,
  ) {
    super();
  }

  async put(state: string, payload: OAuthStatePayload): Promise<void> {
    await this.repo.delete({ expiresAt: LessThan(String(Date.now())) });
    const count = await this.repo.count();
    if (count >= MAX_SIZE) {
      throw new AppError('OAuth state store at capacity', 503);
    }
    await this.repo.save({
      state,
      teamsUserId: payload.teamsUserId,
      codeVerifier: payload.codeVerifier,
      returnTo: payload.returnTo ?? null,
      expiresAt: String(Date.now() + TTL_MS),
    });
  }

  async consume(state: string): Promise<OAuthStatePayload | null> {
    await this.repo.delete({ expiresAt: LessThan(String(Date.now())) });
    const record = await this.repo.findOne({ where: { state } });
    if (!record) return null;
    await this.repo.delete({ state });
    if (Number(record.expiresAt) <= Date.now()) return null;
    return {
      teamsUserId: record.teamsUserId,
      codeVerifier: record.codeVerifier,
      returnTo: record.returnTo ?? undefined,
    };
  }
}
