import { describe, expect, it } from 'vitest';
import { createHintLimiter, HINT_INTERVAL_MS } from '../../src/features/fallback/rate-limit.js';

const SEC = 1000;

describe('createHintLimiter', () => {
  it('интервал по умолчанию — 30 секунд', () => {
    expect(HINT_INTERVAL_MS).toBe(30 * SEC);
  });

  it('первое сообщение пользователя проходит', () => {
    expect(createHintLimiter().tryAcquire(1, 0)).toBe(true);
  });

  it('граница: на 29 с отказ, на 30 с и 31 с разрешено', () => {
    for (const [seconds, allowed] of [
      [29, false],
      [30, true],
      [31, true],
    ] as const) {
      const limiter = createHintLimiter();
      limiter.tryAcquire(1, 0);
      expect(limiter.tryAcquire(1, seconds * SEC), `${seconds} с`).toBe(allowed);
    }
  });

  it('отказ не сдвигает окно: отсчёт идёт от последней показанной подсказки', () => {
    const limiter = createHintLimiter();
    limiter.tryAcquire(1, 0);
    expect(limiter.tryAcquire(1, 20 * SEC)).toBe(false);
    expect(limiter.tryAcquire(1, 30 * SEC)).toBe(true);
  });

  it('после разрешённой подсказки окно начинается заново', () => {
    const limiter = createHintLimiter();
    limiter.tryAcquire(1, 0);
    limiter.tryAcquire(1, 31 * SEC);
    expect(limiter.tryAcquire(1, 60 * SEC)).toBe(false);
    expect(limiter.tryAcquire(1, 61 * SEC)).toBe(true);
  });

  it('пользователи независимы', () => {
    const limiter = createHintLimiter();
    expect(limiter.tryAcquire(1, 0)).toBe(true);
    expect(limiter.tryAcquire(2, 5 * SEC)).toBe(true);
    expect(limiter.tryAcquire(1, 10 * SEC)).toBe(false);
    expect(limiter.tryAcquire(2, 10 * SEC)).toBe(false);
  });

  it('при большом числе пользователей просроченные записи вычищаются без побочных эффектов', () => {
    const limiter = createHintLimiter();
    for (let id = 1; id <= 1_000; id++) limiter.tryAcquire(id, 0);
    expect(limiter.tryAcquire(5_000, 40 * SEC)).toBe(true);
    expect(limiter.tryAcquire(5_000, 41 * SEC)).toBe(false);
    expect(limiter.tryAcquire(1, 41 * SEC)).toBe(true);
  });
});
