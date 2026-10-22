import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../../context.js';
import type { GalleryCategory, GalleryItem, Locale } from '../../domain/types.js';
import { pick } from '../../i18n/index.js';
import { routeButton, withNavigation } from '../../ui/keyboards.js';
import type { Screen } from '../../ui/render.js';

/** Список категорий галереи. Если фото нет совсем, показываем пустое состояние. */
export function galleryScreen(
  ctx: BotContext,
  locale: Locale,
  categories: GalleryCategory[],
): Screen {
  const keyboard = new InlineKeyboard();
  for (const category of categories) {
    keyboard
      .add(
        routeButton(pick(category.title, locale), {
          kind: 'galleryPhoto',
          category: category.id,
          index: 0,
        }),
      )
      .row();
  }
  return {
    text: categories.length > 0 ? ctx.t('gallery-title') : ctx.t('gallery-empty'),
    keyboard: withNavigation(keyboard, ctx, { kind: 'menu' }),
  };
}

/**
 * Фото альбома с подписью. Листание циклическое: ◀ на первом фото ведёт на последнее,
 * ▶ на последнем на первое (в категории 2–4 фото, тупиков не нужно). При единственном фото
 * стрелок нет. Индекс считается с нуля; на кнопке показывается `index + 1`.
 *
 * Возвращает undefined, если индекс вне диапазона или в категории нет фото: вызывающий код
 * отдаёт такую кнопку в fallback («Кнопка устарела»).
 */
export function galleryPhotoScreen(
  ctx: BotContext,
  locale: Locale,
  categories: GalleryCategory[],
  category: GalleryCategory,
  items: GalleryItem[],
  index: number,
): Screen | undefined {
  const item = items[index];
  if (item === undefined || !Number.isInteger(index) || index < 0) return undefined;

  const total = items.length;
  const photoRoute = (target: number) =>
    ({ kind: 'galleryPhoto', category: category.id, index: target }) as const;

  const keyboard = new InlineKeyboard();
  if (total > 1) {
    keyboard
      .add(routeButton(ctx.t('gallery-prev'), photoRoute((index - 1 + total) % total)))
      .add(routeButton(ctx.t('gallery-counter', { current: index + 1, total }), { kind: 'noop' }))
      .add(routeButton(ctx.t('gallery-next'), photoRoute((index + 1) % total)))
      .row();
  } else {
    keyboard.add(routeButton(ctx.t('gallery-counter', { current: 1, total: 1 }), { kind: 'noop' }));
    keyboard.row();
  }

  const others = categories.filter((c) => c.id !== category.id);
  others.forEach((other, i) => {
    keyboard.add(
      routeButton(pick(other.title, locale), {
        kind: 'galleryPhoto',
        category: other.id,
        index: 0,
      }),
    );
    if (i % 2 === 1 || i === others.length - 1) keyboard.row();
  });

  // К мастеру, чья это работа, иначе общий выбор мастера.
  keyboard
    .add(
      routeButton(
        ctx.t('btn-book'),
        item.masterId === undefined
          ? { kind: 'booking' }
          : { kind: 'bookingMaster', masterId: item.masterId },
      ),
    )
    .row();

  return {
    text: ctx.t('gallery-photo', {
      category: pick(category.title, locale),
      caption: pick(item.caption, locale),
    }),
    keyboard: withNavigation(keyboard, ctx, { kind: 'gallery' }),
    photo: item.file,
  };
}
