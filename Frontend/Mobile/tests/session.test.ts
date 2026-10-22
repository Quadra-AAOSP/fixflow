import { describe, expect, it } from 'vitest';

import {
  BACKEND_IDLE_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
} from '../constants/session';

describe('session timing contract', () => {
  it('has a positive heartbeat interval', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBeGreaterThan(0);
  });

  it('refreshes the session before the backend idle timeout expires', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBeLessThan(BACKEND_IDLE_TIMEOUT_MS);
  });

  it('matches the backend 30-minute idle timeout', () => {
    expect(BACKEND_IDLE_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });
});
