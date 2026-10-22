import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../../context.js';
import type { Business, Locale, Master, Service } from '../../domain/types.js';
import { pick } from '../../i18n/index.js';
import { ANY_MASTER, type Route } from '../../ui/callback.js';
import { routeButton, withNavigation } from '../../ui/keyboards.js';
import type { Screen } from '../../ui/render.js';
import type { BookingChannel, BookingOffer, BookingOption } from './provider.js';

type Button = ReturnType<typeof routeButton> | { text: string; url: string };

/** Подписи кнопок: на экране «нет ответа» у каналов салона добавляется пометка. */
interface ChannelLabels {
  channel: Record<BookingChannel, string>;
  call: string;
}

const masterLabels = (ctx: BotContext): ChannelLabels => ({
  channel: {
    whatsapp: ctx.t('btn-whatsapp'),
    telegram: ctx.t('btn-telegram'),
    instagram: ctx.t('btn-instagram'),
  },
  call: ctx.t('btn-call'),
});

const salonLabels = (ctx: BotContext): ChannelLabels => ({
  channel: {
    whatsapp: ctx.t('booking-salon-whatsapp'),
    telegram: ctx.t('booking-salon-telegram'),
    instagram: ctx.t('booking-salon-instagram'),
  },
  call: ctx.t('booking-salon-call'),
});

/** Кнопки каналов по два в ряд; «Позвонить» ведёт на sendContact через callback. */
function addOptionButtons(
  keyboard: InlineKeyboard,
  options: BookingOption[],
  labels: ChannelLabels,
  callRoute: Route,
): void {
  const buttons: Button[] = options.map((option) =>
    option.kind === 'link'
      ? { text: labels.channel[option.channel], url: option.url }
      : routeButton(labels.call, callRoute),
  );
  buttons.forEach((button, i) => {
    keyboard.add(button);
    if (i % 2 === 1) keyboard.row();
  });
  if (buttons.length % 2 === 1) keyboard.row();
}

/**
 * Выбор мастера: «Любой» и мастера. С услугой (`b:s:<услуга>`) переданы только те, кто её выполняет,
 * а «Назад» ведёт в группу этой услуги.
 */
export function bookingScreen(
  ctx: BotContext,
  locale: Locale,
  masters: Master[],
  service?: Service,
): Screen {
  const withService = service === undefined ? {} : { serviceId: service.id };
  const keyboard = new InlineKeyboard()
    .add(
      routeButton(ctx.t('booking-any-master'), {
        kind: 'bookingMaster',
        masterId: ANY_MASTER,
        ...withService,
      }),
    )
    .row();
  for (const master of masters) {
    keyboard
      .add(
        routeButton(
          ctx.t('masters-button', {
            name: pick(master.name, locale),
            specialization: pick(master.specialization, locale),
          }),
          { kind: 'bookingMaster', masterId: master.id, ...withService },
        ),
      )
      .row();
  }

  const text =
    service === undefined
      ? ctx.t('booking-choose')
      : ctx.t('booking-choose-service', { service: pick(service.title, locale) });
  const back: Route =
    service === undefined ? { kind: 'menu' } : { kind: 'servicesGroup', group: service.group };
  return { text, keyboard: withNavigation(keyboard, ctx, back) };
}

export interface ChannelsParams {
  /** Не задан для «Любой»: тогда каналы принадлежат салону. */
  master?: Master;
  service?: Service;
  offer: BookingOffer;
}

/** Каналы связи с готовым текстом сообщения, который можно скопировать, если клиент его не подставил. */
export function bookingChannelsScreen(
  ctx: BotContext,
  locale: Locale,
  { master, service, offer }: ChannelsParams,
): Screen {
  const lines = [
    master === undefined
      ? ctx.t('booking-channels-salon')
      : ctx.t('booking-channels-master', { master: pick(master.name, locale) }),
  ];
  if (service !== undefined) {
    lines.push(ctx.t('booking-channels-service', { service: pick(service.title, locale) }));
  }
  if (master !== undefined) {
    lines.push(ctx.t('masters-card-hours', { hours: pick(master.contactHours, locale) }));
  }
  lines.push('', ctx.t('booking-channels-message', { message: offer.message }));

  const keyboard = new InlineKeyboard();
  addOptionButtons(
    keyboard,
    offer.options,
    masterLabels(ctx),
    master === undefined ? { kind: 'bookingCall' } : { kind: 'masterCall', masterId: master.id },
  );
  // Для «Любой» отвечает сам салон, запасных каналов у него нет.
  if (master !== undefined) {
    keyboard
      .add(
        routeButton(ctx.t('booking-no-reply-button'), {
          kind: 'bookingNoReply',
          masterId: master.id,
        }),
      )
      .row();
  }

  const back: Route =
    service === undefined ? { kind: 'booking' } : { kind: 'bookingService', serviceId: service.id };
  return { text: lines.join('\n'), keyboard: withNavigation(keyboard, ctx, back) };
}

export interface NoReplyParams {
  master: Master;
  masterOffer: BookingOffer;
  business: Business;
  salonOffer: BookingOffer;
}

/** «Мастер не отвечает?»: часы связи, каналы мастера и общий контакт салона. */
export function bookingNoReplyScreen(
  ctx: BotContext,
  locale: Locale,
  { master, masterOffer, business, salonOffer }: NoReplyParams,
): Screen {
  const lines = [
    ctx.t('booking-no-reply-title', { master: pick(master.name, locale) }),
    ctx.t('masters-card-hours', { hours: pick(master.contactHours, locale) }),
    ctx.t('booking-no-reply-hint'),
    '',
    ctx.t('booking-no-reply-salon', { name: pick(business.name, locale) }),
  ];
  if (business.contacts.phone !== undefined) {
    lines.push(ctx.t('masters-card-phone', { phone: business.contacts.phone }));
  }

  const keyboard = new InlineKeyboard();
  addOptionButtons(keyboard, masterOffer.options, masterLabels(ctx), {
    kind: 'masterCall',
    masterId: master.id,
  });
  addOptionButtons(keyboard, salonOffer.options, salonLabels(ctx), { kind: 'bookingCall' });

  return {
    text: lines.join('\n'),
    keyboard: withNavigation(keyboard, ctx, { kind: 'bookingMaster', masterId: master.id }),
  };
}
