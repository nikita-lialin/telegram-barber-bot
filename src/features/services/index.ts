import { Composer } from 'grammy';
import type { BotContext } from '../../context.js';
import type { CatalogRepository } from '../../data/repository.js';
import { currentLocale } from '../../i18n/index.js';
import { decode } from '../../ui/callback.js';
import { renderScreen } from '../../ui/render.js';
import { serviceGroupScreen, servicesScreen } from './view.js';

/** Раздел «Услуги и цены»: группы и список услуг группы. */
export function createServicesFeature(catalog: CatalogRepository): Composer<BotContext> {
  const feature = new Composer<BotContext>();

  feature.callbackQuery(/^s(:|$)/, async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    const locale = currentLocale(ctx);

    if (route?.kind === 'services') {
      await ctx.answerCallbackQuery();
      await renderScreen(ctx, servicesScreen(ctx, locale, await catalog.getServiceGroups()));
      return;
    }

    if (route?.kind === 'servicesGroup') {
      const group = (await catalog.getServiceGroups()).find((g) => g.id === route.group);
      if (group === undefined) return next();
      await ctx.answerCallbackQuery();
      const services = await catalog.getServices(group.id);
      await renderScreen(ctx, serviceGroupScreen(ctx, locale, group, services));
      return;
    }

    return next();
  });

  return feature;
}
