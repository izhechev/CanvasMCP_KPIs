import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { McpModule } from './mcp.module';
import { FastMcpCanvasServer } from './fastmcp.service';

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
    }).compile();

    const server = moduleRef.get(FastMcpCanvasServer);
    expect(server).toBeInstanceOf(FastMcpCanvasServer);
  });
});
