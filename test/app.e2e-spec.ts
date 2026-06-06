import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AppModule } from './../src/app.module';

jest.mock('fastmcp', () => ({
  FastMCP: jest.fn().mockImplementation(() => ({
    addTool: jest.fn(),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mockRepo = {
  findOne: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({ affected: 0 }),
  count: jest.fn().mockResolvedValue(0),
};

const mockDataSource = {
  entityMetadatas: [],
  options: { type: 'postgres' },
  getRepository: jest.fn().mockReturnValue(mockRepo),
  destroy: jest.fn().mockResolvedValue(undefined),
  isInitialized: true,
  manager: {},
};

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.DATABASE_URL = 'postgresql://unused:unused@localhost/test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(mockDataSource)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    delete process.env.DATABASE_URL;
  });

  it('GET /health returns { status: ok }', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
