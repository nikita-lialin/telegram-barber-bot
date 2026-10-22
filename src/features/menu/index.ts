import { Composer } from 'grammy';
import type { BotContext } from '../../context.js';
import { currentLocale } from '../../i18n/index.js';
import { decode } from '../../ui/callback.js';
import { renderScreen } from '../../ui/render.js';
import { mainMenuScreen } from './view.js';

/** Главное меню: команда /menu, кнопка «Главное меню» и пустая кнопка-счётчик. */
export const menuFeature = new Composer<BotContext>();

menuFeature.command('menu', async (ctx) => {
  await renderScreen(ctx, mainMenuScreen(ctx, currentLocale(ctx)));
});

menuFeature.callbackQuery('m', async (ctx) => {
  await ctx.answerCallbackQuery();
  await renderScreen(ctx, mainMenuScreen(ctx, currentLocale(ctx)));
});

menuFeature.callbackQuery('noop', async (ctx) => {
  await ctx.answerCallbackQuery();
});

/**
 * Заглушка для кнопок разделов, которых пока нет. Подключается после всех разделов,
 * поэтому по мере появления настоящих обработчиков заглушка перестаёт срабатывать.
 */
export const stubsFeature = new Composer<BotContext>();

stubsFeature.on('callback_query:data', async (ctx, next) => {
  if (decode(ctx.callbackQuery.data) === undefined) return next();
  await ctx.answerCallbackQuery({ text: ctx.t('stub-coming-soon') });
});
