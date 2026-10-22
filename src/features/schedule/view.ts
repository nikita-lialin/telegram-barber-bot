import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../../context.js';
import {
  getTodayHours,
  getUpcomingExceptions,
  getWeeklyRows,
  isOpenNow,
  nextOpening,
  type DayHours,
  type WeeklyRow,
} from '../../domain/schedule.js';
import type { Locale, Schedule, TimeRange } from '../../domain/types.js';
import { pick } from '../../i18n/index.js';
import { routeButton, withNavigation } from '../../ui/keyboards.js';
import type { Screen } from '../../ui/render.js';

/** Сколько ближайших особых дней показываем: длинный список не нужен клиенту. */
const MAX_EXCEPTIONS = 5;

const EN_DASH = '–';

const formatHours = (hours: TimeRange): string => `${hours.open}${EN_DASH}${hours.close}`;

/** «10 янв» / «Jan 10»: дата из YYYY-MM-DD без участия часового пояса сервера. */
function formatDate(date: string, locale: Locale): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)));
}

function rowLine(ctx: BotContext, row: WeeklyRow): string {
  const days =
    row.from === row.to
      ? ctx.t(`schedule-day-${row.from}`)
      : `${ctx.t(`schedule-day-${row.from}`)}${EN_DASH}${ctx.t(`schedule-day-${row.to}`)}`;
  return ctx.t('schedule-row', {
    days,
    hours: row.hours === null ? ctx.t('schedule-closed-day') : formatHours(row.hours),
  });
}

function exceptionLine(ctx: BotContext, locale: Locale, day: DayHours): string {
  const line = ctx.t('schedule-exception', {
    date: formatDate(day.date, locale),
    hours: day.hours === null ? ctx.t('schedule-closed-day') : formatHours(day.hours),
  });
  return day.note === undefined ? line : `${line} (${pick(day.note, locale)})`;
}

/** Строка «Сейчас открыто / закрыто»; при закрытом салоне добавляет ближайшее открытие. */
function statusLine(ctx: BotContext, locale: Locale, schedule: Schedule, now: Date): string {
  const today = getTodayHours(schedule, now);
  if (isOpenNow(schedule, now) && today.hours !== null) {
    return ctx.t('schedule-status-open', { until: today.hours.close });
  }
  const next = nextOpening(schedule, now);
  if (next === undefined) return ctx.t('schedule-status-closed');
  const when =
    next.daysAhead === 0
      ? ctx.t('schedule-next-today', { time: next.time })
      : next.daysAhead === 1
        ? ctx.t('schedule-next-tomorrow', { time: next.time })
        : ctx.t('schedule-next-later', {
            day: ctx.t(`schedule-day-${next.weekday}`),
            date: formatDate(next.date, locale),
            time: next.time,
          });
  return `${ctx.t('schedule-status-closed')}\n${when}`;
}

/** График: статус на сейчас, будни, выходные, особые дни. `now` передаётся снаружи. */
export function scheduleScreen(
  ctx: BotContext,
  locale: Locale,
  schedule: Schedule,
  now: Date,
): Screen {
  const rows = getWeeklyRows(schedule);
  const lines = [
    ctx.t('schedule-title'),
    '',
    statusLine(ctx, locale, schedule, now),
    '',
    ctx.t('schedule-weekdays'),
    ...rows.weekdays.map((row) => rowLine(ctx, row)),
    '',
    ctx.t('schedule-weekend'),
    ...rows.weekend.map((row) => rowLine(ctx, row)),
    '',
    ctx.t('schedule-special-title'),
    ...getUpcomingExceptions(schedule, now)
      .slice(0, MAX_EXCEPTIONS)
      .map((day) => exceptionLine(ctx, locale, day)),
    `ℹ️ ${pick(schedule.specialDaysNote, locale)}`,
  ];

  const keyboard = new InlineKeyboard()
    .add(routeButton(ctx.t('btn-book'), { kind: 'booking' }))
    .row();
  return { text: lines.join('\n'), keyboard: withNavigation(keyboard, ctx, { kind: 'menu' }) };
}
