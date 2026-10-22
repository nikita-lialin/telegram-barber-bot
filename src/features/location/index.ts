import { Composer } from 'grammy';
import type { BotContext } from '../../context.js';
import type { CatalogRepository } from '../../data/repository.js';
import { currentLocale } from '../../i18n/index.js';
import { renderScreen } from '../../ui/render.js';
import { locationScreen } from './view.js';

/**
 * Раздел «Как нас найти». Всё одним сообщением с фото и кнопками-ссылками на карты.
 * sendVenue не используем: он шёл бы отдельным сообщением вне замены экрана, а координат
 * (business.geo) в данных нет; ссылки на Яндекс и Google покрывают сценарий.
 */
export function createLocationFeature(catalog: CatalogRepository): Composer<BotContext> {
  const feature = new Composer<BotContext>();

  feature.callbackQuery('loc', async (ctx) => {
    const business = await catalog.getBusiness();
    await ctx.answerCallbackQuery();
    await renderScreen(ctx, locationScreen(ctx, currentLocale(ctx), business));
  });

  return feature;
}
