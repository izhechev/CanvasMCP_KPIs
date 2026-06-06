import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { McpModule } from './mcp.module';
import { FastMcpCanvasServer } from './fastmcp.service';
import { TokenRecordEntity } from '../database/entities/token-record.entity';
import { SessionRecordEntity } from '../database/entities/session-record.entity';
import { OAuthStateRecordEntity } from '../database/entities/oauth-state-record.entity';
import { AuthCodeRecordEntity } from '../database/entities/auth-code-record.entity';

// Mocks: FastMCP (module mock — addTool, start, stop)
jest.mock('fastmcp', () => ({
  FastMCP: jest.fn().mockImplementation(() => ({
    addTool: jest.fn(),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('McpModule', () => {
  it('provides FastMcpCanvasServer', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), McpModule],
    })
      .overrideProvider(getRepositoryToken(TokenRecordEntity))
      .useValue({})
      .overrideProvider(getRepositoryToken(SessionRecordEntity))
      .useValue({})
      .overrideProvider(getRepositoryToken(OAuthStateRecordEntity))
      .useValue({})
      .overrideProvider(getRepositoryToken(AuthCodeRecordEntity))
      .useValue({})
      .compile();

    const server = moduleRef.get(FastMcpCanvasServer);
    expect(server).toBeInstanceOf(FastMcpCanvasServer);
  });
});
