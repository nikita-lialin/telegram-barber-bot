import { join } from 'node:path';
import { I18n } from '@grammyjs/i18n';
import type { InlineKeyboardMarkup } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import type { BotContext } from '../../src/context.js';
import { loadCatalog } from '../../src/data/loader.js';
import type { Locale, Schedule } from '../../src/domain/types.js';
import { locationScreen } from '../../src/features/location/view.js';
import { scheduleScreen } from '../../src/features/schedule/view.js';
import { PROJECT_ROOT } from '../../src/paths.js';

const catalog = loadCatalog(PROJECT_ROOT);
const i18n = new I18n({
  defaultLocale: 'en',
  directory: join(PROJECT_ROOT, 'locales'),
  fluentBundleOptions: { useIsolating: false },
});
const fakeCtx = (locale: Locale) =>
  ({
    t: (key: string, params?: Record<string, never>) => i18n.t(locale, key, params),
  }) as BotContext;

const flat = (markup: unknown) => (markup as InlineKeyboardMarkup).inline_keyboard.flat();
const callbacks = (markup: unknown) =>
  flat(markup).flatMap((b) => ('callback_data' in b ? [b.callback_data] : []));
const urls = (markup: unknown) => flat(markup).flatMap((b) => ('url' in b ? [b.url] : []));

const THU_NOON = new Date('2026-10-22T09:00:00Z'); // 12:00 МСК
const THU_NIGHT = new Date('2026-10-22T19:00:00Z'); // 22:00 МСК
const SUN_NIGHT = new Date('2026-10-25T18:00:00Z'); // вс 21:00 МСК

describe('scheduleScreen', () => {
  it('открыто: статус, будни, выходные, особые дни', () => {
    const screen = scheduleScreen(fakeCtx('ru'), 'ru', catalog.schedule, THU_NOON);
    expect(screen.text).toContain('🟢 Сейчас открыто, до 20:00');
    expect(screen.text).toContain('Будни\nПн–Пт: 10:00–20:00');
    expect(screen.text).toContain('Выходные\nСб: 10:00–18:00\nВс: 11:00–16:00');
    expect(screen.text).toContain('Особые дни');
    expect(screen.text).toContain(catalog.schedule.specialDaysNote.ru);
    expect(screen.photo).toBeUndefined();
  });

  it('закрыто вечером: показано завтрашнее открытие', () => {
    const screen = scheduleScreen(fakeCtx('ru'), 'ru', catalog.schedule, THU_NIGHT);
    expect(screen.text).toContain('🔴 Сейчас закрыто\nОткроемся завтра в 10:00');
  });

  it('закрыто в воскресенье вечером: понедельник с датой', () => {
    // вс вечером → «завтра» это понедельник
    const screen = scheduleScreen(fakeCtx('en'), 'en', catalog.schedule, SUN_NIGHT);
    expect(screen.text).toContain('🔴 Closed now\nWe open tomorrow at 10:00');
  });

  it('до открытия: «сегодня», английский текст', () => {
    const screen = scheduleScreen(
      fakeCtx('en'),
      'en',
      catalog.schedule,
      new Date('2026-10-22T05:00:00Z'),
    );
    expect(screen.text).toContain('We open today at 10:00');
    expect(screen.text).toContain('Weekdays\nMon–Fri: 10:00–20:00');
  });

  it('дальнее открытие содержит день недели и дату', () => {
    const closedMon: Schedule = {
      ...catalog.schedule,
      exceptions: [{ date: '2026-10-26', hours: null }],
    };
    const screen = scheduleScreen(fakeCtx('ru'), 'ru', closedMon, SUN_NIGHT);
    expect(screen.text).toContain('Откроемся: Вт, 27 окт. в 10:00');
    expect(screen.text).toContain('• 26 окт.: выходной');
  });

  it('особый день с пометкой попадает в список', () => {
    const s: Schedule = {
      ...catalog.schedule,
      exceptions: [
        {
          date: '2026-12-31',
          hours: { open: '10:00', close: '16:00' },
          note: { ru: 'Предновогодний', en: 'New Year Eve' },
        },
      ],
    };
    const screen = scheduleScreen(fakeCtx('ru'), 'ru', s, THU_NOON);
    expect(screen.text).toContain('• 31 дек.: 10:00–16:00 (Предновогодний)');
  });

  it('кнопки: запись, «Назад» и «Главное меню»', () => {
    const screen = scheduleScreen(fakeCtx('ru'), 'ru', catalog.schedule, THU_NOON);
    expect(callbacks(screen.keyboard)).toEqual(['b', 'm', 'm']);
  });
});

describe('locationScreen', () => {
  it('адрес, подсказка и фото входа', () => {
    const screen = locationScreen(fakeCtx('ru'), 'ru', catalog.business);
    expect(screen.photo).toBe('location/entrance.png');
    expect(screen.text).toContain(catalog.business.address.ru);
    expect(screen.text).toContain(catalog.business.entranceHint.ru);
    expect(screen.text.length).toBeLessThanOrEqual(1024);
  });

  it('кнопки карт ведут на ссылки из данных, затем запись и навигация', () => {
    const screen = locationScreen(fakeCtx('en'), 'en', catalog.business);
    expect(urls(screen.keyboard)).toEqual([
      catalog.business.mapLinks.yandex,
      catalog.business.mapLinks.google,
    ]);
    expect(callbacks(screen.keyboard)).toEqual(['b', 'm', 'm']);
    expect(flat(screen.keyboard).map((b) => b.text)).toContain('🗺 Yandex Maps');
  });

  it('если задана одна ссылка, кнопка одна', () => {
    const { yandex } = catalog.business.mapLinks;
    const screen = locationScreen(fakeCtx('ru'), 'ru', {
      ...catalog.business,
      mapLinks: { ...(yandex === undefined ? {} : { yandex }) },
    });
    expect(urls(screen.keyboard)).toEqual([yandex]);
  });
});
