import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../../context.js';
import { buildContactLinks, buildContactMessage } from '../../domain/contacts.js';
import type { Translate } from '../../domain/translate.js';
import type { Locale, Master, ServiceGroup, ServiceGroupId } from '../../domain/types.js';
import { pick } from '../../i18n/index.js';
import { routeButton, withNavigation } from '../../ui/keyboards.js';
import type { Screen } from '../../ui/render.js';

const translator =
  (ctx: BotContext): Translate =>
  (key, params) =>
    ctx.t(key, params);

const groupLabel = (group: ServiceGroup, locale: Locale): string =>
  `${group.emoji} ${pick(group.title, locale)}`;

/**
 * Список мастеров. Без `active` показаны все, с `active` только те, кто выполняет услуги группы.
 * Под списком кнопки фильтра по группам; активная отмечена галочкой, «Все мастера» снимает фильтр.
 */
export function mastersScreen(
  ctx: BotContext,
  locale: Locale,
  masters: Master[],
  groups: ServiceGroup[],
  active?: ServiceGroupId,
): Screen {
  const keyboard = new InlineKeyboard();
  for (const master of masters) {
    keyboard
      .add(
        routeButton(
          ctx.t('masters-button', {
            name: pick(master.name, locale),
            specialization: pick(master.specialization, locale),
          }),
          { kind: 'masterCard', masterId: master.id },
        ),
      )
      .row();
  }

  groups.forEach((group, i) => {
    const label =
      group.id === active ? `✓ ${groupLabel(group, locale)}` : groupLabel(group, locale);
    keyboard.add(routeButton(label, { kind: 'mastersFilter', group: group.id }));
    if (i % 2 === 1) keyboard.row();
  });
  keyboard.row();
  if (active !== undefined) {
    keyboard.add(routeButton(ctx.t('masters-filter-all'), { kind: 'masters' })).row();
  }

  const activeGroup = groups.find((g) => g.id === active);
  const text =
    activeGroup === undefined
      ? ctx.t('masters-title')
      : ctx.t('masters-filtered-title', { group: groupLabel(activeGroup, locale) });

  return { text, keyboard: withNavigation(keyboard, ctx, { kind: 'menu' }) };
}

/** Карточка мастера: фото, специализация, часы связи, телефон и кнопки каналов. */
export function masterCardScreen(ctx: BotContext, locale: Locale, master: Master): Screen {
  const name = pick(master.name, locale);
  const links = buildContactLinks(
    master.contacts,
    buildContactMessage(translator(ctx), { masterName: name }),
  );

  const lines = [
    name,
    ctx.t('masters-card-specialization', { specialization: pick(master.specialization, locale) }),
    ctx.t('masters-card-hours', { hours: pick(master.contactHours, locale) }),
  ];
  if (master.contacts.phone !== undefined) {
    lines.push(ctx.t('masters-card-phone', { phone: master.contacts.phone }));
  }

  const keyboard = new InlineKeyboard()
    .add(routeButton(ctx.t('btn-book'), { kind: 'bookingMaster', masterId: master.id }))
    .row();
  const channels: Array<ReturnType<typeof routeButton> | { text: string; url: string }> = [];
  if (links.whatsapp !== undefined)
    channels.push({ text: ctx.t('btn-whatsapp'), url: links.whatsapp });
  if (links.phone !== undefined) {
    channels.push(routeButton(ctx.t('btn-call'), { kind: 'masterCall', masterId: master.id }));
  }
  if (links.telegram !== undefined)
    channels.push({ text: ctx.t('btn-telegram'), url: links.telegram });
  if (links.instagram !== undefined) {
    channels.push({ text: ctx.t('btn-instagram'), url: links.instagram });
  }
  channels.forEach((button, i) => {
    keyboard.add(button);
    if (i % 2 === 1) keyboard.row();
  });
  keyboard.row();

  return {
    text: lines.join('\n'),
    keyboard: withNavigation(keyboard, ctx, { kind: 'masters' }),
    photo: master.photo,
  };
}
