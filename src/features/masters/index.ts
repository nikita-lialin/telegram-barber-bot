import { Composer } from 'grammy';
import type { BotContext } from '../../context.js';
import type { CatalogRepository } from '../../data/repository.js';
import { normalizePhone } from '../../domain/contacts.js';
import { currentLocale, pick } from '../../i18n/index.js';
import { decode } from '../../ui/callback.js';
import { renderScreen } from '../../ui/render.js';
import { masterCardScreen, mastersScreen } from './view.js';

/** Раздел «Наши мастера»: список, фильтр по группе, карточка и кнопка «Позвонить». */
export function createMastersFeature(catalog: CatalogRepository): Composer<BotContext> {
  const feature = new Composer<BotContext>();

  feature.callbackQuery(/^ms(:|$)/, async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    const locale = currentLocale(ctx);

    if (route?.kind === 'masters') {
      const [masters, groups] = await Promise.all([
        catalog.getMasters(),
        catalog.getServiceGroups(),
      ]);
      await ctx.answerCallbackQuery();
      await renderScreen(ctx, mastersScreen(ctx, locale, masters, groups));
      return;
    }

    if (route?.kind === 'mastersFilter') {
      const [masters, groups] = await Promise.all([
        catalog.getMasters(route.group),
        catalog.getServiceGroups(),
      ]);
      await ctx.answerCallbackQuery();
      await renderScreen(ctx, mastersScreen(ctx, locale, masters, groups, route.group));
      return;
    }

    if (route?.kind === 'masterCard') {
      const master = await catalog.getMaster(route.masterId);
      if (master === undefined) return next();
      await ctx.answerCallbackQuery();
      await renderScreen(ctx, masterCardScreen(ctx, locale, master));
      return;
    }

    if (route?.kind === 'masterCall') {
      const master = await catalog.getMaster(route.masterId);
      if (master === undefined) return next();
      const phone = master.contacts.phone;
      if (phone === undefined) {
        await ctx.answerCallbackQuery({ text: ctx.t('masters-no-phone') });
        return;
      }
      await ctx.answerCallbackQuery();
      // Карточка контакта содержит кнопку звонка: tel: в inline-кнопках Telegram не поддерживает.
      await ctx.replyWithContact(normalizePhone(phone), pick(master.name, locale));
      return;
    }

    return next();
  });

  return feature;
}
