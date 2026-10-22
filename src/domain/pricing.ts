import type { Translate } from './translate.js';
import type { Price, Service } from './types.js';

const NBSP = ' ';

/** 1500 → «1 500» с неразрывным пробелом: число не переносится по строкам. */
export function formatAmount(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** «1 500 ₽» для фиксированной цены и «от 4 500 ₽» для цены по сложности. */
export function formatPrice(price: Price, t: Translate): string {
  const amount = formatAmount(price.amount);
  return price.kind === 'from' ? t('price-from', { amount }) : t('price-fixed', { amount });
}

/** «45 мин», «60 мин», «2 ч», «2–4 ч»: часы только если все значения кратны часу и не меньше двух. */
export function formatDuration(duration: Service['durationMin'], t: Translate): string {
  const { min, max } = duration;
  const values = max === undefined || max === min ? [min] : [min, max];
  if (values.every((v) => v % 60 === 0 && v >= 120)) {
    return t('duration-hours', { value: values.map((v) => v / 60).join('–') });
  }
  return t('duration-minutes', { value: values.join('–') });
}
