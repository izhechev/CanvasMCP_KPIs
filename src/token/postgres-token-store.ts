import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { EncryptedTokenRecord, TokenStore } from './token-store';
import { TokenRecordEntity } from '../database/entities/token-record.entity';

@Injectable()
export class PostgresTokenStore extends TokenStore {
  constructor(
    @InjectRepository(TokenRecordEntity)
    private readonly repo: Repository<TokenRecordEntity>,
  ) {
    super();
  }

  async save(record: EncryptedTokenRecord): Promise<void> {
    await this.repo.save(record);
  }

  async find(teamsUserId: string): Promise<EncryptedTokenRecord | null> {
    return this.repo.findOne({ where: { teamsUserId } });
  }

  async delete(teamsUserId: string): Promise<void> {
    await this.repo.delete({ teamsUserId });
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.repo.delete({ lastActiveAt: LessThan(cutoff) });
    return result.affected ?? 0;
  }
}
