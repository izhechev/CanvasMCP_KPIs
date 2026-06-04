import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TokenRecordEntity } from './entities/token-record.entity';
import { SessionRecordEntity } from './entities/session-record.entity';
import { OAuthStateRecordEntity } from './entities/oauth-state-record.entity';
import { AuthCodeRecordEntity } from './entities/auth-code-record.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [
          TokenRecordEntity,
          SessionRecordEntity,
          OAuthStateRecordEntity,
          AuthCodeRecordEntity,
        ],
        synchronize: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
