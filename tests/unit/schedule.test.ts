import { describe, expect, it } from 'vitest';
import {
  getTodayHours,
  getUpcomingExceptions,
  getWeeklyRows,
  isOpenNow,
  nextOpening,
} from '../../src/domain/schedule.js';
import type { Schedule } from '../../src/domain/types.js';

const text = { ru: 'ру', en: 'en' };
const range = (open: string, close: string) => ({ open, close });

/** Москва UTC+3 без перехода на летнее время. */
const salon: Schedule = {
  timezone: 'Europe/Moscow',
  weekly: {
    mon: range('10:00', '20:00'),
    tue: range('10:00', '20:00'),
    wed: range('10:00', '20:00'),
    thu: range('10:00', '20:00'),
    fri: range('10:00', '20:00'),
    sat: range('10:00', '18:00'),
    sun: range('11:00', '16:00'),
  },
  exceptions: [],
  specialDaysNote: text,
};

const withExceptions = (exceptions: Schedule['exceptions']): Schedule => ({
  ...salon,
  exceptions,
});

// 2026-10-22 — четверг; 2026-10-24 — суббота; 2026-10-25 — воскресенье; 2026-10-26 — понедельник.
const at = (iso: string) => new Date(iso);

describe('isOpenNow: границы часов', () => {
  it.each([
    ['2026-10-22T06:59:59Z', false], // 09:59:59 МСК
    ['2026-10-22T07:00:00Z', true], // 10:00, открытие включительно
    ['2026-10-22T16:59:59Z', true], // 19:59:59
    ['2026-10-22T17:00:00Z', false], // 20:00, закрытие не включительно
  ])('%s → %s', (iso, expected) => {
    expect(isOpenNow(salon, at(iso))).toBe(expected);
  });

  it('суббота и воскресенье используют свои часы', () => {
    expect(isOpenNow(salon, at('2026-10-24T15:30:00Z'))).toBe(false); // сб 18:30
    expect(isOpenNow(salon, at('2026-10-24T14:59:00Z'))).toBe(true); // сб 17:59
    expect(isOpenNow(salon, at('2026-10-25T07:59:00Z'))).toBe(false); // вс 10:59
    expect(isOpenNow(salon, at('2026-10-25T08:00:00Z'))).toBe(true); // вс 11:00
  });
});

describe('полночь и дата в часовом поясе салона', () => {
  it('23:59 и 00:00 по Москве попадают в разные дни', () => {
    expect(getTodayHours(salon, at('2026-10-22T20:59:59Z')).date).toBe('2026-10-22');
    const after = getTodayHours(salon, at('2026-10-22T21:00:00Z'));
    expect(after.date).toBe('2026-10-23');
    expect(after.weekday).toBe('fri');
  });

  it('по UTC ещё четверг, по салону уже пятница', () => {
    expect(getTodayHours(salon, at('2026-10-22T22:30:00Z')).weekday).toBe('fri');
  });

  it('другой часовой пояс сдвигает и статус, и дату', () => {
    const ny: Schedule = { ...salon, timezone: 'America/New_York' };
    // 14:00Z = 10:00 EDT (UTC−4): открыто, хотя по Москве уже 17:00
    expect(isOpenNow(ny, at('2026-10-22T14:00:00Z'))).toBe(true);
    expect(isOpenNow(ny, at('2026-10-22T13:59:00Z'))).toBe(false);
    // 03:00Z пятницы = 23:00 EDT четверга
    expect(getTodayHours(ny, at('2026-10-23T03:00:00Z')).date).toBe('2026-10-22');
  });

  it('смена летнего времени учитывается (Нью-Йорк, 1 ноября 2026)', () => {
    const ny: Schedule = { ...salon, timezone: 'America/New_York' };
    // после перевода часов UTC−5: воскресенье, открытие в 11:00 EST = 16:00Z
    expect(isOpenNow(ny, at('2026-11-01T15:00:00Z'))).toBe(false);
    expect(isOpenNow(ny, at('2026-11-01T16:00:00Z'))).toBe(true);
  });
});

describe('особые дни', () => {
  it('закрытый день перекрывает недельное расписание', () => {
    const s = withExceptions([{ date: '2026-10-22', hours: null, note: text }]);
    expect(isOpenNow(s, at('2026-10-22T10:00:00Z'))).toBe(false);
    const today = getTodayHours(s, at('2026-10-22T10:00:00Z'));
    expect(today.hours).toBeNull();
    expect(today.note).toEqual(text);
  });

  it('сокращённый и удлинённый день', () => {
    const s = withExceptions([
      { date: '2026-10-22', hours: range('12:00', '14:00') },
      { date: '2026-10-23', hours: range('08:00', '23:00') },
    ]);
    expect(isOpenNow(s, at('2026-10-22T08:59:00Z'))).toBe(false); // 11:59
    expect(isOpenNow(s, at('2026-10-22T09:00:00Z'))).toBe(true); // 12:00
    expect(isOpenNow(s, at('2026-10-22T11:00:00Z'))).toBe(false); // 14:00
    expect(isOpenNow(s, at('2026-10-23T19:30:00Z'))).toBe(true); // 22:30
  });

  it('getUpcomingExceptions: прошедшие отброшены, остальные по порядку', () => {
    const s = withExceptions([
      { date: '2026-12-31', hours: range('10:00', '16:00') },
      { date: '2026-10-01', hours: null },
      { date: '2026-10-22', hours: null },
    ]);
    expect(getUpcomingExceptions(s, at('2026-10-22T10:00:00Z')).map((d) => d.date)).toEqual([
      '2026-10-22',
      '2026-12-31',
    ]);
  });
});

describe('nextOpening', () => {
  it('до открытия: сегодня', () => {
    expect(nextOpening(salon, at('2026-10-22T05:00:00Z'))).toEqual({
      date: '2026-10-22',
      weekday: 'thu',
      time: '10:00',
      daysAhead: 0,
    });
  });

  it('после закрытия: завтра', () => {
    expect(nextOpening(salon, at('2026-10-22T18:00:00Z'))?.daysAhead).toBe(1);
  });

  it('ровно в момент открытия «сегодня» уже прошло', () => {
    expect(nextOpening(salon, at('2026-10-22T07:00:00Z'))?.date).toBe('2026-10-23');
  });

  it('вечером воскресенья ближайший понедельник', () => {
    expect(nextOpening(salon, at('2026-10-25T14:00:00Z'))).toEqual({
      date: '2026-10-26',
      weekday: 'mon',
      time: '10:00',
      daysAhead: 1,
    });
  });

  it('учитывает дату по салону после полуночи', () => {
    // 21:30Z четверга = 00:30 пятницы по Москве: открытие в тот же день
    expect(nextOpening(salon, at('2026-10-22T21:30:00Z'))?.daysAhead).toBe(0);
  });

  it('пропускает закрытые особые дни и выходные в расписании', () => {
    const s: Schedule = {
      ...withExceptions([
        { date: '2026-10-23', hours: null },
        { date: '2026-10-24', hours: null },
      ]),
      weekly: { ...salon.weekly, sun: null },
    };
    expect(nextOpening(s, at('2026-10-22T18:00:00Z'))).toMatchObject({
      date: '2026-10-26',
      daysAhead: 4,
    });
  });

  it('не открывается никогда: undefined', () => {
    const closed: Schedule = {
      ...salon,
      weekly: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
    };
    expect(nextOpening(closed, at('2026-10-22T10:00:00Z'))).toBeUndefined();
  });
});

describe('getWeeklyRows', () => {
  it('будни и выходные отдельно, одинаковые дни объединены', () => {
    expect(getWeeklyRows(salon)).toEqual({
      weekdays: [{ from: 'mon', to: 'fri', hours: range('10:00', '20:00') }],
      weekend: [
        { from: 'sat', to: 'sat', hours: range('10:00', '18:00') },
        { from: 'sun', to: 'sun', hours: range('11:00', '16:00') },
      ],
    });
  });

  it('разные будни и общий выходной', () => {
    const s: Schedule = {
      ...salon,
      weekly: { ...salon.weekly, wed: range('12:00', '20:00'), sat: null, sun: null },
    };
    const rows = getWeeklyRows(s);
    expect(rows.weekdays.map((r) => `${r.from}-${r.to}`)).toEqual([
      'mon-tue',
      'wed-wed',
      'thu-fri',
    ]);
    expect(rows.weekend).toEqual([{ from: 'sat', to: 'sun', hours: null }]);
  });
});
