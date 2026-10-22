import { Composer } from 'grammy';
import type { BotContext } from '../../context.js';
import { currentLocale } from '../../i18n/index.js';
import { mainMenuKeyboard } from '../../ui/keyboards.js';
import { renderScreen } from '../../ui/render.js';
import { mainMenuScreen } from '../menu/view.js';
import { createHintLimiter } from './rate-limit.js';

/**
 * Последний в цепочке: устаревшая кнопка и любое сообщение, которое не узнал ни один раздел.
 * Команды /start, /menu, /help обрабатываются выше и досюда не доходят.
 */
export function createFallbackFeature(now: () => Date = () => new Date()): Composer<BotContext> {
  const feature = new Composer<BotContext>();
  const limiter = createHintLimiter();

  feature.on('callback_query:data', async (ctx) => {
    await ctx.answerCallbackQuery({ text: ctx.t('errors-stale-button') });
    await renderScreen(ctx, mainMenuScreen(ctx, currentLocale(ctx)));
  });

  // Текст, стикер, фото, голосовое, документ и прочее: одна подсказка не чаще раза в 30 секунд.
  feature.on('message', async (ctx) => {
    if (ctx.from === undefined) return;
    if (!limiter.tryAcquire(ctx.from.id, now().getTime())) return;
    await renderScreen(ctx, {
      text: ctx.t('errors-unknown-input'),
      keyboard: mainMenuKeyboard(ctx),
    });
  });

  return feature;
}
