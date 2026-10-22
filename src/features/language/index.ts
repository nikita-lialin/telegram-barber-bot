import { Composer } from 'grammy';
import type { BotContext } from '../../context.js';
import { decode } from '../../ui/callback.js';
import { renderScreen } from '../../ui/render.js';
import { mainMenuScreen } from '../menu/view.js';

/** Смена языка: сохраняет выбор в сессии и перерисовывает меню на новом языке. */
export const languageFeature = new Composer<BotContext>();

languageFeature.callbackQuery(/^l:/, async (ctx, next) => {
  const route = decode(ctx.callbackQuery.data);
  if (route?.kind !== 'language') return next();
  ctx.session.locale = route.locale;
  ctx.i18n.useLocale(route.locale);
  await ctx.answerCallbackQuery();
  await renderScreen(ctx, mainMenuScreen(ctx, route.locale));
});
