import { Test, TestingModule } from '@nestjs/testing';
import { FastMCP } from 'fastmcp';
import { CanvasService } from '../canvas/canvas.service';
import { TokenService } from '../token/token.service';
import { SessionStore } from '../auth/session-store';
import { FastMcpCanvasServer } from './fastmcp.service';
import { TOOLS } from './tools';

// Mocks: FastMCP (module mock — addTool, start, stop), CanvasService, TokenService, SessionStore
jest.mock('fastmcp', () => ({
  FastMCP: jest.fn().mockImplementation(() => ({
    addTool: jest.fn(),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mockCanvasApi = {} as CanvasService;
const mockTokenService = {} as TokenService;
const mockSessionStore = {
  resolve: jest.fn().mockResolvedValue(null),
} as unknown as SessionStore;

async function createServer(): Promise<FastMcpCanvasServer> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      FastMcpCanvasServer,
      { provide: CanvasService, useValue: mockCanvasApi },
      { provide: TokenService, useValue: mockTokenService },
      { provide: SessionStore, useValue: mockSessionStore },
    ],
  }).compile();
  return module.get(FastMcpCanvasServer);
}

describe('FastMcpCanvasServer', () => {
  let server: FastMcpCanvasServer;
  let mockFastMcp: { addTool: jest.Mock; start: jest.Mock; stop: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    server = await createServer();
    mockFastMcp = (FastMCP as jest.Mock).mock.results[0]
      .value as typeof mockFastMcp;
  });

  describe('onModuleInit', () => {
    it('registers every tool in TOOLS', () => {
      server.onModuleInit();
      expect(mockFastMcp.addTool).toHaveBeenCalledTimes(TOOLS.length);
    });

    it('forwards each tool name to FastMCP', () => {
      server.onModuleInit();
      const names = mockFastMcp.addTool.mock.calls.map(
        (call: [{ name: string }]) => call[0].name,
      );
      expect(names).toEqual(TOOLS.map((t) => t.name));
    });

    it('does not start HTTP transport when MCP_PORT is not set', () => {
      delete process.env.MCP_PORT;
      server.onModuleInit();
      expect(mockFastMcp.start).not.toHaveBeenCalled();
    });

    it('starts HTTP transport when MCP_PORT is set', () => {
      process.env.MCP_PORT = '3001';
      server.onModuleInit();
      expect(mockFastMcp.start).toHaveBeenCalledWith({
        transportType: 'httpStream',
        httpStream: { port: 3001 },
      });
      delete process.env.MCP_PORT;
    });
  });

  describe('onModuleDestroy', () => {
    it('stops the FastMCP server', async () => {
      await server.onModuleDestroy();
      expect(mockFastMcp.stop).toHaveBeenCalled();
    });
  });

  describe('authenticate callback', () => {
    it('resolves Bearer token to studentId', async () => {
      const { authenticate } = (FastMCP as jest.Mock).mock.calls[0][0] as {
        authenticate: (req: {
          headers?: Record<string, string>;
        }) => Promise<{ studentId: string }>;
      };
      mockSessionStore.resolve.mockResolvedValue('student-123');

      const result = await authenticate({
        headers: { authorization: 'Bearer my-token' },
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockSessionStore.resolve).toHaveBeenCalledWith('my-token');
      expect(result).toEqual({ studentId: 'student-123' });
    });

    it('returns empty studentId when no Authorization header', async () => {
      const { authenticate } = (FastMCP as jest.Mock).mock.calls[0][0] as {
        authenticate: (req: {
          headers?: Record<string, string>;
        }) => Promise<{ studentId: string }>;
      };
      mockSessionStore.resolve.mockResolvedValue(null);

      const result = await authenticate({ headers: {} });
      expect(result).toEqual({ studentId: '' });
    });
  });

  describe('execute callback', () => {
    it('injects studentId from session into tool deps', async () => {
      server.onModuleInit();
      const { execute } = mockFastMcp.addTool.mock.calls[0][0] as {
        execute: (
          args: Record<string, unknown>,
          ctx: { session: { studentId: string } },
        ) => Promise<string>;
      };

      const handleSpy = jest
        .spyOn(TOOLS[0], 'handle')
        .mockResolvedValue({ ok: true });

      await execute({}, { session: { studentId: 'stu-xyz' } });

      expect(handleSpy).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: 'stu-xyz' }),
        {},
      );
      handleSpy.mockRestore();
    });
  });

  describe('start error handling', () => {
    it('logs an error when the MCP server fails to start', async () => {
      process.env.MCP_PORT = '3001';
      const loggerSpy = jest
        .spyOn(server['logger'], 'error')
        .mockImplementation();
      mockFastMcp.start.mockRejectedValue(new Error('port in use'));

      server.onModuleInit();
      await new Promise((r) => setTimeout(r, 0));

      expect(loggerSpy).toHaveBeenCalledWith(
        'MCP server failed to start',
        expect.any(Error),
      );
      delete process.env.MCP_PORT;
      loggerSpy.mockRestore();
    });
  });
});
