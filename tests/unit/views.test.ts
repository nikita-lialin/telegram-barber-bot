import { join } from 'node:path';
import { I18n } from '@grammyjs/i18n';
import type { InlineKeyboardMarkup } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import type { BotContext } from '../../src/context.js';
import { loadCatalog } from '../../src/data/loader.js';
import type { Locale, Master } from '../../src/domain/types.js';
import { masterCardScreen, mastersScreen } from '../../src/features/masters/view.js';
import { serviceGroupScreen, servicesScreen } from '../../src/features/services/view.js';
import { PROJECT_ROOT } from '../../src/paths.js';
import { MAX_CALLBACK_BYTES } from '../../src/ui/callback.js';

const catalog = loadCatalog(PROJECT_ROOT);
const groups = [...catalog.groups].sort((a, b) => a.order - b.order);
const i18n = new I18n({
  defaultLocale: 'en',
  directory: join(PROJECT_ROOT, 'locales'),
  fluentBundleOptions: { useIsolating: false },
});

const fakeCtx = (locale: Locale) =>
  ({
    t: (key: string, params?: Record<string, never>) => i18n.t(locale, key, params),
  }) as BotContext;

const plain = (text: string) => text.replaceAll(' ', ' ');
const rows = (markup: unknown) => (markup as InlineKeyboardMarkup).inline_keyboard;
const flat = (markup: unknown) => rows(markup).flat();
const callbacks = (markup: unknown) =>
  flat(markup).flatMap((b) => ('callback_data' in b ? [b.callback_data] : []));
const urls = (markup: unknown) => flat(markup).flatMap((b) => ('url' in b ? [b.url] : []));

function group(id: string) {
  const found = groups.find((g) => g.id === id);
  if (!found) throw new Error(id);
  return found;
}
function master(id: string): Master {
  const found = catalog.masters.find((m) => m.id === id);
  if (!found) throw new Error(id);
  return found;
}

describe('servicesScreen', () => {
  it('4 группы, затем «Назад» и «Главное меню»', () => {
    const screen = servicesScreen(fakeCtx('ru'), 'ru', groups);
    expect(callbacks(screen.keyboard)).toEqual([
      's:g:men',
      's:g:women',
      's:g:kids',
      's:g:coloring',
      'm',
      'm',
    ]);
    expect(flat(screen.keyboard).map((b) => b.text)).toContain('🎨 Окрашивание');
    expect(screen.photo).toBeUndefined();
  });
});

describe('serviceGroupScreen', () => {
  it('фиксированные цены: без «от» и без подсказки, запись через общий экран', () => {
    const ctx = fakeCtx('ru');
    const services = catalog.services.filter((s) => s.group === 'men');
    const screen = serviceGroupScreen(ctx, 'ru', group('men'), services);
    const text = plain(screen.text);
    expect(text).toContain('• Стрижка — 1 500 ₽, 45 мин');
    expect(text).toContain('• Борода — 800 ₽, 30 мин');
    expect(text).toContain('• Стрижка и борода — 2 100 ₽, 70 мин');
    expect(text).not.toContain('от ');
    expect(text).not.toContain('уточняйте');
    expect(callbacks(screen.keyboard)).toEqual(['b', 'ms:f:men', 's', 'm']);
  });

  it('нетипичная работа: «от», диапазон часов, заметка и подсказка', () => {
    const ctx = fakeCtx('ru');
    const services = catalog.services.filter((s) => s.group === 'coloring');
    const screen = serviceGroupScreen(ctx, 'ru', group('coloring'), services);
    const text = plain(screen.text);
    expect(text).toContain('• Окрашивание — от 4 500 ₽, 2–4 ч');
    expect(text).toContain('Итог зависит от длины и сложности');
    expect(text).toContain('Стоимость уточняйте у мастера');
    // единственная услуга группы: запись сразу на неё
    expect(callbacks(screen.keyboard)).toEqual(['b:s:coloring-full', 'ms:f:coloring', 's', 'm']);
  });

  it('английский вариант', () => {
    const services = catalog.services.filter((s) => s.group === 'coloring');
    const screen = serviceGroupScreen(fakeCtx('en'), 'en', group('coloring'), services);
    const text = plain(screen.text);
    expect(text).toContain('• Coloring — from 4 500 ₽, 2–4 h');
    expect(text).toContain('Please ask the master for the exact price');
    expect(flat(screen.keyboard).map((b) => b.text)).toContain('💬 Ask the master');
  });

  it('пустая группа не ломает экран', () => {
    const screen = serviceGroupScreen(fakeCtx('ru'), 'ru', group('kids'), []);
    expect(screen.text).toContain('пока нет услуг');
    expect(callbacks(screen.keyboard)).toContain('b');
  });
});

describe('mastersScreen', () => {
  it('без фильтра: 4 мастера, 4 фильтра, назад в меню', () => {
    const screen = mastersScreen(fakeCtx('ru'), 'ru', catalog.masters, groups);
    expect(callbacks(screen.keyboard)).toEqual([
      'ms:c:alexey',
      'ms:c:marina',
      'ms:c:olga',
      'ms:c:denis',
      'ms:f:men',
      'ms:f:women',
      'ms:f:kids',
      'ms:f:coloring',
      'm',
      'm',
    ]);
    expect(flat(screen.keyboard)[2]?.text).toBe('Ольга — Окрашивание и уход');
  });

  it('с фильтром: отмечена активная группа и есть «Все мастера»', () => {
    const screen = mastersScreen(fakeCtx('ru'), 'ru', [master('olga')], groups, 'coloring');
    expect(callbacks(screen.keyboard)).toContain('ms:c:olga');
    expect(callbacks(screen.keyboard)).not.toContain('ms:c:alexey');
    const texts = flat(screen.keyboard).map((b) => b.text);
    expect(texts).toContain('✓ 🎨 Окрашивание');
    expect(texts).toContain('Все мастера');
    expect(callbacks(screen.keyboard)).toContain('ms');
    expect(screen.text).toContain('Окрашивание');
  });
});

describe('masterCardScreen', () => {
  it('фото, часы связи, телефон и все четыре канала', () => {
    const screen = masterCardScreen(fakeCtx('ru'), 'ru', master('olga'));
    expect(screen.photo).toBe('masters/olga.png');
    expect(screen.text).toContain('Ольга');
    expect(screen.text).toContain('Окрашивание и уход');
    expect(screen.text).toContain('Вт–Сб 11:00–19:00');
    expect(screen.text).toContain('+7 999 000-00-03');

    expect(callbacks(screen.keyboard)).toEqual(['b:m:olga', 'ms:call:olga', 'ms', 'm']);
    const [whatsapp, telegram, instagram] = urls(screen.keyboard);
    expect(whatsapp).toMatch(/^https:\/\/wa\.me\/79990000003\?text=/);
    expect(new URL(whatsapp!).searchParams.get('text')).toContain('Ольга');
    expect(telegram).toBe('https://t.me/barber_olga_demo');
    expect(instagram).toBe('https://instagram.com/olga.color.demo');
  });

  it('показывает только заполненные каналы', () => {
    const only: Master = { ...master('olga'), contacts: { telegram: 'barber_olga_demo' } };
    const screen = masterCardScreen(fakeCtx('en'), 'en', only);
    expect(urls(screen.keyboard)).toEqual(['https://t.me/barber_olga_demo']);
    expect(callbacks(screen.keyboard)).not.toContain('ms:call:olga');
    expect(screen.text).not.toContain('📞');
  });
});

describe('callback_data на реальных данных', () => {
  it('все кнопки обоих разделов укладываются в 64 байта', () => {
    const screens = [
      servicesScreen(fakeCtx('ru'), 'ru', groups),
      ...groups.map((g) =>
        serviceGroupScreen(
          fakeCtx('ru'),
          'ru',
          g,
          catalog.services.filter((s) => s.group === g.id),
        ),
      ),
      mastersScreen(fakeCtx('ru'), 'ru', catalog.masters, groups, 'men'),
      ...catalog.masters.map((m) => masterCardScreen(fakeCtx('ru'), 'ru', m)),
    ];
    for (const screen of screens) {
      for (const data of callbacks(screen.keyboard)) {
        expect(Buffer.byteLength(data)).toBeLessThanOrEqual(MAX_CALLBACK_BYTES);
      }
    }
  });
});
