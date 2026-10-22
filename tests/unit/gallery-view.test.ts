import { join } from 'node:path';
import { I18n } from '@grammyjs/i18n';
import type { InlineKeyboardMarkup } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import type { BotContext } from '../../src/context.js';
import { loadCatalog } from '../../src/data/loader.js';
import type { Locale } from '../../src/domain/types.js';
import { galleryPhotoScreen, galleryScreen } from '../../src/features/gallery/view.js';
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
const texts = (markup: unknown) => flat(markup).map((b) => b.text);

const categories = [...catalog.galleryCategories].sort((a, b) => a.order - b.order);
const category = (id: string) => {
  const found = categories.find((c) => c.id === id);
  if (found === undefined) throw new Error(`нет категории ${id}`);
  return found;
};
const itemsOf = (id: string) => catalog.galleryItems.filter((i) => i.category === id);

const photo = (id: string, index: number, locale: Locale = 'ru') =>
  galleryPhotoScreen(fakeCtx(locale), locale, categories, category(id), itemsOf(id), index);

describe('galleryScreen', () => {
  it('кнопка на первое фото каждой категории, «Главное меню» в конце', () => {
    const screen = galleryScreen(fakeCtx('ru'), 'ru', categories);
    expect(screen.text).toContain('Наши работы');
    expect(callbacks(screen.keyboard)).toEqual([
      'g:p:men:0',
      'g:p:women:0',
      'g:p:kids:0',
      'g:p:coloring:0',
      'm',
      'm',
    ]);
    expect(texts(screen.keyboard).slice(0, 4)).toEqual([
      'Мужские',
      'Женские',
      'Детские',
      'Окрашивание',
    ]);
    expect(screen.photo).toBeUndefined();
  });

  it('пустая галерея: сообщение и навигация', () => {
    const screen = galleryScreen(fakeCtx('ru'), 'ru', []);
    expect(screen.text).toBe('Фото работ пока нет.');
    expect(callbacks(screen.keyboard)).toEqual(['m', 'm']);
  });
});

describe('galleryPhotoScreen', () => {
  it('первое фото: файл, подпись, счётчик, ◀ ведёт на последнее', () => {
    const screen = photo('men', 0);
    expect(screen?.photo).toBe('gallery/men/men-1.png');
    expect(screen?.text).toContain('Мужские');
    expect(screen?.text).toContain('Классическая мужская стрижка');
    expect(texts(screen?.keyboard)).toContain('1 / 3');
    expect(callbacks(screen?.keyboard).slice(0, 3)).toEqual(['g:p:men:2', 'noop', 'g:p:men:1']);
  });

  it('среднее фото: соседи по обе стороны', () => {
    const screen = photo('men', 1);
    expect(screen?.photo).toBe('gallery/men/men-2.png');
    expect(texts(screen?.keyboard)).toContain('2 / 3');
    expect(callbacks(screen?.keyboard).slice(0, 3)).toEqual(['g:p:men:0', 'noop', 'g:p:men:2']);
  });

  it('последнее фото: ▶ ведёт на первое', () => {
    const screen = photo('men', 2);
    expect(screen?.photo).toBe('gallery/men/men-3.png');
    expect(texts(screen?.keyboard)).toContain('3 / 3');
    expect(callbacks(screen?.keyboard).slice(0, 3)).toEqual(['g:p:men:1', 'noop', 'g:p:men:0']);
  });

  it('другие категории, запись к мастеру работы, «Назад» в галерею и меню', () => {
    const screen = photo('men', 0);
    expect(callbacks(screen?.keyboard).slice(3)).toEqual([
      'g:p:women:0',
      'g:p:kids:0',
      'g:p:coloring:0',
      'b:m:alexey',
      'g',
      'm',
    ]);
    expect(texts(screen?.keyboard)).not.toContain('Мужские');
  });

  it('подпись берётся на языке пользователя', () => {
    const screen = photo('men', 1, 'en');
    expect(screen?.text).toContain('Men');
    expect(screen?.text).toContain('Fade and beard shaping');
  });

  it('одно фото: без стрелок, только счётчик 1 / 1', () => {
    const [only] = itemsOf('kids');
    if (only === undefined) throw new Error('нет фото');
    const screen = galleryPhotoScreen(fakeCtx('ru'), 'ru', categories, category('kids'), [only], 0);
    expect(callbacks(screen?.keyboard).slice(0, 1)).toEqual(['noop']);
    expect(texts(screen?.keyboard)).toContain('1 / 1');
    expect(texts(screen?.keyboard)).not.toContain('◀');
  });

  it('граничные индексы: вне диапазона, отрицательный, дробный и пустая категория', () => {
    expect(photo('men', 3)).toBeUndefined();
    expect(photo('men', 999)).toBeUndefined();
    expect(photo('men', -1)).toBeUndefined();
    expect(photo('men', 1.5)).toBeUndefined();
    const empty = galleryPhotoScreen(fakeCtx('ru'), 'ru', categories, category('men'), [], 0);
    expect(empty).toBeUndefined();
  });

  it('фото без мастера ведёт на общий выбор мастера', () => {
    const [first] = itemsOf('men');
    if (first === undefined) throw new Error('нет фото');
    const withoutMaster = { ...first, masterId: undefined };
    const screen = galleryPhotoScreen(
      fakeCtx('ru'),
      'ru',
      categories,
      category('men'),
      [withoutMaster],
      0,
    );
    expect(callbacks(screen?.keyboard)).toContain('b');
  });
});
