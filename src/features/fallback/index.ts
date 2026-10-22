import { Composer } from 'grammy';
import type { BotContext } from '../../context.js';
import { currentLocale } from '../../i18n/index.js';
import { mainMenuScreen } from '../menu/view.js';
import { renderScreen } from '../../ui/render.js';

/**
 * Устаревшая кнопка: callback, который не узнал ни один раздел.
 * Непонятный текстовый ввод пока не обрабатывается, это следующий шаг.
 */
export const fallbackFeature = new Composer<BotContext>();

fallbackFeature.on('callback_query:data', async (ctx) => {
  await ctx.answerCallbackQuery({ text: ctx.t('errors-stale-button') });
  await renderScreen(ctx, mainMenuScreen(ctx, currentLocale(ctx)));
});
