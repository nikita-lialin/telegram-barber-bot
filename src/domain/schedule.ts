import { WEEKDAYS } from '../data/schemas.js';
import type { LocalizedText, Schedule, TimeRange, Weekday } from './types.js';

/** Как далеко вперёд ищем ближайшее открытие: хватает на любой разумный перерыв и високосный год. */
const LOOKAHEAD_DAYS = 366;

export interface DayHours {
  /** Дата в часовом поясе салона, YYYY-MM-DD. */
  date: string;
  weekday: Weekday;
  /** null: в этот день салон закрыт. */
  hours: TimeRange | null;
  /** Пометка особого дня, если день задан исключением. */
  note?: LocalizedText;
}

export interface NextOpening {
  date: string;
  weekday: Weekday;
  /** Время открытия, HH:MM. */
  time: string;
  /** 0: сегодня, 1: завтра и так далее. */
  daysAhead: number;
}

/** Строка недельного расписания: подряд идущие дни с одинаковыми часами сведены в диапазон. */
export interface WeeklyRow {
  from: Weekday;
  to: Weekday;
  hours: TimeRange | null;
}

export interface WeeklyRows {
  weekdays: WeeklyRow[];
  weekend: WeeklyRow[];
}

interface ZonedNow {
  date: string;
  weekday: Weekday;
  /** Минут с полуночи по времени салона. */
  minutes: number;
}

const SHORT_WEEKDAY: Record<string, Weekday> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
};

/** Расписание не бывает короче суток по числу минут, поэтому парсим «HH:MM» в минуты. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':');
  return Number(h) * 60 + Number(m);
}

/** Дата и время в часовом поясе салона; серверный пояс не участвует. */
function zonedNow(now: Date, timezone: string): ZonedNow {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: SHORT_WEEKDAY[get('weekday')] ?? 'mon',
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

function weekdayOf(date: string): Weekday {
  const [y, m, d] = date.split('-').map(Number);
  const index = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  // getUTCDay: 0 — воскресенье
  return WEEKDAYS[(index + 6) % 7] ?? 'mon';
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}

/** Часы на конкретную дату: исключение перекрывает недельное расписание. */
export function getHoursOn(schedule: Schedule, date: string): DayHours {
  const weekday = weekdayOf(date);
  const exception = schedule.exceptions.find((e) => e.date === date);
  if (exception !== undefined) {
    return {
      date,
      weekday,
      hours: exception.hours,
      ...(exception.note === undefined ? {} : { note: exception.note }),
    };
  }
  return { date, weekday, hours: schedule.weekly[weekday] };
}

/** Часы работы сегодня (по дате в часовом поясе салона). */
export function getTodayHours(schedule: Schedule, now: Date): DayHours {
  return getHoursOn(schedule, zonedNow(now, schedule.timezone).date);
}

/** Открыто ли в момент `now`: открытие включительно, закрытие нет. */
export function isOpenNow(schedule: Schedule, now: Date): boolean {
  const local = zonedNow(now, schedule.timezone);
  const { hours } = getHoursOn(schedule, local.date);
  return (
    hours !== null &&
    local.minutes >= toMinutes(hours.open) &&
    local.minutes < toMinutes(hours.close)
  );
}

/** Ближайшее открытие строго после `now`; undefined, если в ближайший год салон не работает. */
export function nextOpening(schedule: Schedule, now: Date): NextOpening | undefined {
  const local = zonedNow(now, schedule.timezone);
  for (let daysAhead = 0; daysAhead <= LOOKAHEAD_DAYS; daysAhead += 1) {
    const day = getHoursOn(schedule, addDays(local.date, daysAhead));
    if (day.hours === null) continue;
    if (daysAhead === 0 && toMinutes(day.hours.open) <= local.minutes) continue;
    return { date: day.date, weekday: day.weekday, time: day.hours.open, daysAhead };
  }
  return undefined;
}

const sameHours = (a: TimeRange | null, b: TimeRange | null): boolean =>
  a === b || (a !== null && b !== null && a.open === b.open && a.close === b.close);

function groupDays(schedule: Schedule, days: readonly Weekday[]): WeeklyRow[] {
  const rows: WeeklyRow[] = [];
  for (const day of days) {
    const hours = schedule.weekly[day];
    const last = rows.at(-1);
    if (last !== undefined && sameHours(last.hours, hours)) last.to = day;
    else rows.push({ from: day, to: day, hours });
  }
  return rows;
}

/** Будни (пн–пт) и выходные (сб–вс) отдельно; внутри группы одинаковые дни объединены. */
export function getWeeklyRows(schedule: Schedule): WeeklyRows {
  return {
    weekdays: groupDays(schedule, WEEKDAYS.slice(0, 5)),
    weekend: groupDays(schedule, WEEKDAYS.slice(5)),
  };
}

/** Особые дни не раньше `now` (по дате салона), по возрастанию даты. */
export function getUpcomingExceptions(schedule: Schedule, now: Date): DayHours[] {
  const today = zonedNow(now, schedule.timezone).date;
  return schedule.exceptions
    .filter((e) => e.date >= today)
    .map((e) => getHoursOn(schedule, e.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}
