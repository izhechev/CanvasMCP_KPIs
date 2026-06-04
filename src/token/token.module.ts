import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenRecordEntity } from '../database/entities/token-record.entity';
import { TokenStore } from './token-store';
import { PostgresTokenStore } from './postgres-token-store';
import { TokenService } from './token.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([TokenRecordEntity])],
  providers: [
    TokenService,
    { provide: TokenStore, useClass: PostgresTokenStore },
  ],
  exports: [TokenService],
})
export class TokenModule {}
