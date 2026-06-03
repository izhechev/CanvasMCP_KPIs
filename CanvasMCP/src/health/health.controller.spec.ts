import { HealthController } from './health.controller';

// Mocks: none — pure unit test
describe('HealthController', () => {
  it('check returns { status: "ok" }', () => {
    expect(new HealthController().check()).toEqual({ status: 'ok' });
  });
});
