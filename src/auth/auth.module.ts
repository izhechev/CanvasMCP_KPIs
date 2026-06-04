import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthStateStore } from './oauth-state-store';
import { AuthCodeStore } from './auth-code-store';
import { SessionStore } from './session-store';
import { PostgresOAuthStateStore } from './postgres-oauth-state-store';
import { PostgresAuthCodeStore } from './postgres-auth-code-store';
import { PostgresSessionStore } from './postgres-session-store';
import { TokenModule } from '../token/token.module';
import { OAuthStateRecordEntity } from '../database/entities/oauth-state-record.entity';
import { AuthCodeRecordEntity } from '../database/entities/auth-code-record.entity';
import { SessionRecordEntity } from '../database/entities/session-record.entity';

@Module({
  imports: [
    ConfigModule,
    TokenModule,
    TypeOrmModule.forFeature([
      OAuthStateRecordEntity,
      AuthCodeRecordEntity,
      SessionRecordEntity,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: OAuthStateStore, useClass: PostgresOAuthStateStore },
    { provide: AuthCodeStore, useClass: PostgresAuthCodeStore },
    { provide: SessionStore, useClass: PostgresSessionStore },
  ],
  exports: [AuthService, SessionStore],
})
export class AuthModule {}
