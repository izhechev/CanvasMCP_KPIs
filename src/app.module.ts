import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CanvasModule } from './canvas/canvas.module';
import { HealthController } from './health/health.controller';
import { McpModule } from './mcp/mcp.module';
import { TokenModule } from './token/token.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    CanvasModule,
    McpModule,
    TokenModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
