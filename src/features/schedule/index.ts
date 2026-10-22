import { Composer } from 'grammy';
import type { BotContext } from '../../context.js';
import type { CatalogRepository } from '../../data/repository.js';
import { currentLocale } from '../../i18n/index.js';
import { renderScreen } from '../../ui/render.js';
import { scheduleScreen } from './view.js';

/** Раздел «График работы». Часы подставляются параметром, чтобы тесты не зависели от реального времени. */
export function createScheduleFeature(
  catalog: CatalogRepository,
  now: () => Date = () => new Date(),
): Composer<BotContext> {
  const feature = new Composer<BotContext>();

  feature.callbackQuery('sch', async (ctx) => {
    const schedule = await catalog.getSchedule();
    await ctx.answerCallbackQuery();
    await renderScreen(ctx, scheduleScreen(ctx, currentLocale(ctx), schedule, now()));
  });

  return feature;
}
