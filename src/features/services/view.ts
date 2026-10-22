import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../../context.js';
import { formatDuration, formatPrice } from '../../domain/pricing.js';
import type { Translate } from '../../domain/translate.js';
import type { Locale, Service, ServiceGroup } from '../../domain/types.js';
import { pick } from '../../i18n/index.js';
import { routeButton, withNavigation } from '../../ui/keyboards.js';
import type { Screen } from '../../ui/render.js';

const translator =
  (ctx: BotContext): Translate =>
  (key, params) =>
    ctx.t(key, params);

/** Список групп услуг. */
export function servicesScreen(ctx: BotContext, locale: Locale, groups: ServiceGroup[]): Screen {
  const keyboard = new InlineKeyboard();
  for (const group of groups) {
    keyboard
      .add(
        routeButton(`${group.emoji} ${pick(group.title, locale)}`, {
          kind: 'servicesGroup',
          group: group.id,
        }),
      )
      .row();
  }
  return {
    text: ctx.t('services-title'),
    keyboard: withNavigation(keyboard, ctx, { kind: 'menu' }),
  };
}

/** Услуги группы с ценой и длительностью; «от» и подсказка про уточнение цены у мастера. */
export function serviceGroupScreen(
  ctx: BotContext,
  locale: Locale,
  group: ServiceGroup,
  services: Service[],
): Screen {
  const t = translator(ctx);
  const heading = `${group.emoji} ${pick(group.title, locale)}`;

  const lines = services.map((service) => {
    const line = ctx.t('services-item', {
      title: pick(service.title, locale),
      price: formatPrice(service.price, t),
      duration: formatDuration(service.durationMin, t),
    });
    return service.note === undefined
      ? line
      : `${line}\n${ctx.t('services-item-note', { note: pick(service.note, locale) })}`;
  });
  const body = lines.length > 0 ? lines.join('\n') : ctx.t('services-empty');
  const hint = services.some((s) => s.price.kind === 'from')
    ? `\n\n${ctx.t('services-ask-master-hint')}`
    : '';

  // Если в группе одна услуга, запись сразу идёт на неё, иначе мастер выбирается на экране записи.
  const [only] = services;
  const bookRoute =
    services.length === 1 && only !== undefined
      ? ({ kind: 'bookingService', serviceId: only.id } as const)
      : ({ kind: 'booking' } as const);

  const keyboard = new InlineKeyboard()
    .add(routeButton(ctx.t('btn-book'), bookRoute))
    .add(routeButton(ctx.t('btn-ask-master'), { kind: 'mastersFilter', group: group.id }))
    .row();

  return {
    text: `${heading}\n\n${body}${hint}`,
    keyboard: withNavigation(keyboard, ctx, { kind: 'services' }),
  };
}
