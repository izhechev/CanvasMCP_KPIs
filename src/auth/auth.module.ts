import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InMemoryOAuthStateStore, OAuthStateStore } from './oauth-state-store';
import { InMemoryAuthCodeStore, AuthCodeStore } from './auth-code-store';
import { InMemorySessionStore, SessionStore } from './session-store';
import { TokenModule } from '../token/token.module';

@Module({
  imports: [ConfigModule, TokenModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: OAuthStateStore, useClass: InMemoryOAuthStateStore },
    { provide: AuthCodeStore, useClass: InMemoryAuthCodeStore },
    { provide: SessionStore, useClass: InMemorySessionStore },
  ],
  exports: [AuthService, SessionStore],
})
export class AuthModule {}
