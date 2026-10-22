import { describe, expect, it } from 'vitest';
import { formatAmount, formatDuration, formatPrice } from '../../src/domain/pricing.js';
import type { Translate } from '../../src/domain/translate.js';

const t: Translate = (key, params) => `${key}|${Object.values(params ?? {}).join(',')}`;

describe('formatAmount', () => {
  it('разделяет тысячи неразрывным пробелом', () => {
    expect(formatAmount(800)).toBe('800');
    expect(formatAmount(1500)).toBe('1 500');
    expect(formatAmount(1234567)).toBe('1 234 567');
  });
});

describe('formatPrice', () => {
  it('фиксированная и «от» используют разные ключи', () => {
    expect(formatPrice({ kind: 'fixed', amount: 1500 }, t)).toBe('price-fixed|1 500');
    expect(formatPrice({ kind: 'from', amount: 4500 }, t)).toBe('price-from|4 500');
  });
});

describe('formatDuration', () => {
  it('минуты для значений не кратных часу', () => {
    expect(formatDuration({ min: 45 }, t)).toBe('duration-minutes|45');
    expect(formatDuration({ min: 70 }, t)).toBe('duration-minutes|70');
    expect(formatDuration({ min: 30, max: 90 }, t)).toBe('duration-minutes|30–90');
    expect(formatDuration({ min: 60 }, t)).toBe('duration-minutes|60');
    expect(formatDuration({ min: 60, max: 120 }, t)).toBe('duration-minutes|60–120');
  });

  it('часы для кратных часу, в том числе диапазон', () => {
    expect(formatDuration({ min: 120 }, t)).toBe('duration-hours|2');
    expect(formatDuration({ min: 120, max: 240 }, t)).toBe('duration-hours|2–4');
  });

  it('max равный min не даёт диапазон', () => {
    expect(formatDuration({ min: 45, max: 45 }, t)).toBe('duration-minutes|45');
  });
});
