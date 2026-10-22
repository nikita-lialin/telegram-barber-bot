import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../../context.js';
import type { Business, Locale } from '../../domain/types.js';
import { pick } from '../../i18n/index.js';
import { routeButton, withNavigation } from '../../ui/keyboards.js';
import type { Screen } from '../../ui/render.js';

/**
 * Адрес, подсказка про вход и фото входа одним сообщением: текст уходит подписью к фото.
 * Кнопки карты показаны только для заданных в данных ссылок.
 */
export function locationScreen(ctx: BotContext, locale: Locale, business: Business): Screen {
  const text = [
    ctx.t('location-title'),
    '',
    ctx.t('location-address', { address: pick(business.address, locale) }),
    ctx.t('location-entrance', { hint: pick(business.entranceHint, locale) }),
  ].join('\n');

  const keyboard = new InlineKeyboard();
  const { yandex, google } = business.mapLinks;
  if (yandex !== undefined) keyboard.url(ctx.t('location-map-yandex'), yandex);
  if (google !== undefined) keyboard.url(ctx.t('location-map-google'), google);
  keyboard
    .row()
    .add(routeButton(ctx.t('btn-book'), { kind: 'booking' }))
    .row();

  return {
    text,
    keyboard: withNavigation(keyboard, ctx, { kind: 'menu' }),
    photo: business.entrancePhoto,
  };
}
