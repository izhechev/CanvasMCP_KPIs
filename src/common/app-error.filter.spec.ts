import { ArgumentsHost } from '@nestjs/common';
import { AppErrorFilter } from './app-error.filter';
import { CanvasRateLimitError, OAuthStateError } from './errors';

// Mocks: ArgumentsHost (switchToHttp stub)
describe('AppErrorFilter', () => {
  function makeHost(status: jest.Mock): ArgumentsHost {
    return {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;
  }

  it('sends correct status code and JSON body', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    new AppErrorFilter().catch(new OAuthStateError(), makeHost(status));
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Invalid or expired OAuth state',
      error: 'OAuthStateError',
    });
  });

  it('uses the subclass HTTP status', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    new AppErrorFilter().catch(new CanvasRateLimitError(), makeHost(status));
    expect(status).toHaveBeenCalledWith(429);
  });
});
