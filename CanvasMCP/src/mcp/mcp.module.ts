import { Module } from '@nestjs/common';
import { FastMcpCanvasServer } from './fastmcp.service';
import { CanvasModule } from '../canvas/canvas.module';
import { TokenModule } from '../token/token.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [CanvasModule, TokenModule, AuthModule],
  providers: [FastMcpCanvasServer],
  exports: [FastMcpCanvasServer],
})
export class McpModule {}
