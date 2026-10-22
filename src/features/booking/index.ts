import { Composer } from 'grammy';
import type { BotContext } from '../../context.js';
import type { CatalogRepository } from '../../data/repository.js';
import { normalizePhone } from '../../domain/contacts.js';
import type { Translate } from '../../domain/translate.js';
import { currentLocale, pick } from '../../i18n/index.js';
import { ANY_MASTER, decode } from '../../ui/callback.js';
import { renderScreen } from '../../ui/render.js';
import type { BookingProvider } from './provider.js';
import { bookingChannelsScreen, bookingNoReplyScreen, bookingScreen } from './view.js';

/** Раздел «Записаться»: выбор мастера, каналы с готовым текстом, «Мастер не отвечает?». */
export function createBookingFeature(
  catalog: CatalogRepository,
  provider: BookingProvider,
): Composer<BotContext> {
  const feature = new Composer<BotContext>();

  feature.callbackQuery(/^b(:|$)/, async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    const locale = currentLocale(ctx);
    const t: Translate = (key, params) => ctx.t(key, params);

    if (route?.kind === 'booking') {
      const masters = await catalog.getMasters();
      await ctx.answerCallbackQuery();
      await renderScreen(ctx, bookingScreen(ctx, locale, masters));
      return;
    }

    if (route?.kind === 'bookingService') {
      const service = await catalog.getService(route.serviceId);
      if (service === undefined) return next();
      const masters = (await catalog.getMasters()).filter((m) => service.masterIds.includes(m.id));
      await ctx.answerCallbackQuery();
      await renderScreen(ctx, bookingScreen(ctx, locale, masters, service));
      return;
    }

    if (route?.kind === 'bookingMaster') {
      const offer = await provider.getOptions(route.masterId, route.serviceId, { t, locale });
      if (offer === undefined) return next();
      const [master, service] = await Promise.all([
        route.masterId === ANY_MASTER ? undefined : catalog.getMaster(route.masterId),
        route.serviceId === undefined ? undefined : catalog.getService(route.serviceId),
      ]);
      await ctx.answerCallbackQuery();
      await renderScreen(
        ctx,
        bookingChannelsScreen(ctx, locale, {
          ...(master === undefined ? {} : { master }),
          ...(service === undefined ? {} : { service }),
          offer,
        }),
      );
      return;
    }

    if (route?.kind === 'bookingNoReply') {
      const [master, business] = await Promise.all([
        catalog.getMaster(route.masterId),
        catalog.getBusiness(),
      ]);
      if (master === undefined) return next();
      const [masterOffer, salonOffer] = await Promise.all([
        provider.getOptions(master.id, undefined, { t, locale }),
        provider.getOptions(ANY_MASTER, undefined, { t, locale }),
      ]);
      if (masterOffer === undefined || salonOffer === undefined) return next();
      await ctx.answerCallbackQuery();
      await renderScreen(
        ctx,
        bookingNoReplyScreen(ctx, locale, { master, masterOffer, business, salonOffer }),
      );
      return;
    }

    if (route?.kind === 'bookingCall') {
      const business = await catalog.getBusiness();
      const phone = business.contacts.phone;
      if (phone === undefined) {
        await ctx.answerCallbackQuery({ text: ctx.t('booking-no-phone') });
        return;
      }
      await ctx.answerCallbackQuery();
      // Как и у мастера: tel: в inline-кнопках не поддерживается, поэтому карточка контакта.
      await ctx.replyWithContact(normalizePhone(phone), pick(business.name, locale));
      return;
    }

    return next();
  });

  return feature;
}
