import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../../context.js';
import type { Locale } from '../../domain/types.js';
import { routeButton } from '../../ui/keyboards.js';
import type { Screen } from '../../ui/render.js';

/** Язык, на который переключает кнопка: у двух языков это «другой». */
export function otherLocale(locale: Locale): Locale {
  return locale === 'ru' ? 'en' : 'ru';
}

export function mainMenuScreen(ctx: BotContext, locale: Locale, intro?: string): Screen {
  const keyboard = new InlineKeyboard()
    .add(routeButton(ctx.t('menu-services'), { kind: 'services' }))
    .row()
    .add(routeButton(ctx.t('menu-masters'), { kind: 'masters' }))
    .row()
    .add(routeButton(ctx.t('menu-gallery'), { kind: 'gallery' }))
    .row()
    .add(routeButton(ctx.t('menu-schedule'), { kind: 'schedule' }))
    .row()
    .add(routeButton(ctx.t('menu-location'), { kind: 'location' }))
    .row()
    .add(routeButton(ctx.t('menu-booking'), { kind: 'booking' }))
    .row()
    .add(routeButton(ctx.t('menu-language'), { kind: 'language', locale: otherLocale(locale) }));
  const title = ctx.t('menu-title');
  return { text: intro === undefined ? title : `${intro}\n\n${title}`, keyboard };
}
