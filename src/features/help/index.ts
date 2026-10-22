import { Composer } from 'grammy';
import type { BotContext } from '../../context.js';
import { mainMenuKeyboard } from '../../ui/keyboards.js';
import { renderScreen } from '../../ui/render.js';

export const helpFeature = new Composer<BotContext>();

helpFeature.command('help', async (ctx) => {
  await renderScreen(ctx, { text: ctx.t('help-text'), keyboard: mainMenuKeyboard(ctx) });
});
