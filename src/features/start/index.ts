import { Composer } from 'grammy';
import type { BotContext } from '../../context.js';
import type { CatalogRepository } from '../../data/repository.js';
import { currentLocale, pick } from '../../i18n/index.js';
import { renderScreen } from '../../ui/render.js';
import { mainMenuScreen } from '../menu/view.js';

/** /start: приветствие и главное меню одним сообщением на языке из настроек Telegram. */
export function createStartFeature(catalog: CatalogRepository): Composer<BotContext> {
  const feature = new Composer<BotContext>();

  feature.command('start', async (ctx) => {
    const locale = currentLocale(ctx);
    const business = await catalog.getBusiness();
    const greeting = ctx.t('start-greeting', { salon: pick(business.name, locale) });
    await renderScreen(ctx, mainMenuScreen(ctx, locale, greeting));
  });

  return feature;
}
