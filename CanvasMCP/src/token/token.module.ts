import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InMemoryTokenStore, TokenStore } from './token-store';
import { TokenService } from './token.service';

@Module({
  imports: [ConfigModule],
  providers: [
    TokenService,
    { provide: TokenStore, useClass: InMemoryTokenStore },
  ],
  exports: [TokenService],
})
export class TokenModule {}
