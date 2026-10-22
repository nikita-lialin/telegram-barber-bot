import { join } from 'node:path';
import { I18n } from '@grammyjs/i18n';
import type { InlineKeyboardMarkup } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import type { BotContext } from '../../src/context.js';
import { loadCatalog } from '../../src/data/loader.js';
import { JsonCatalogRepository } from '../../src/data/repository.js';
import type { Locale } from '../../src/domain/types.js';
import { ExternalLinksBookingProvider } from '../../src/features/booking/provider.js';
import {
  bookingChannelsScreen,
  bookingNoReplyScreen,
  bookingScreen,
} from '../../src/features/booking/view.js';
import { PROJECT_ROOT } from '../../src/paths.js';

const data = loadCatalog(PROJECT_ROOT);
const repo = new JsonCatalogRepository(data);
const provider = new ExternalLinksBookingProvider(repo);
const i18n = new I18n({
  defaultLocale: 'en',
  directory: join(PROJECT_ROOT, 'locales'),
  fluentBundleOptions: { useIsolating: false },
});

const translator = (locale: Locale) => (key: string, params?: Record<string, string | number>) =>
  i18n.t(locale, key, params);
const fakeCtx = (locale: Locale) => ({ t: translator(locale) }) as BotContext;

const flat = (markup: unknown) => (markup as InlineKeyboardMarkup).inline_keyboard.flat();
const callbacks = (markup: unknown) =>
  flat(markup).flatMap((b) => ('callback_data' in b ? [b.callback_data] : []));
const urls = (markup: unknown) => flat(markup).flatMap((b) => ('url' in b ? [b.url] : []));
const labels = (markup: unknown) => flat(markup).map((b) => b.text);

async function need<T>(value: Promise<T | undefined>): Promise<T> {
  const found = await value;
  if (found === undefined) throw new Error('нет данных');
  return found;
}

const offerFor = (masterId: string, serviceId: string | undefined, locale: Locale) =>
  need(provider.getOptions(masterId, serviceId, { t: translator(locale), locale }));

describe('ExternalLinksBookingProvider', () => {
  it('мастер и услуга попадают в текст и в ссылку WhatsApp', async () => {
    const service = await need(repo.getService('coloring-full'));
    const offer = await offerFor('olga', 'coloring-full', 'ru');
    expect(offer.message).toBe(
      `Здравствуйте! Хочу записаться. Мастер: Ольга. Услуга: ${service.title.ru}.`,
    );
    const wa = offer.options.find((o) => o.kind === 'link' && o.channel === 'whatsapp');
    const url = wa?.kind === 'link' ? wa.url : '';
    expect(url).toContain('https://wa.me/');
    expect(decodeURIComponent(url.split('?text=')[1] ?? '')).toBe(offer.message);
  });

  it('порядок каналов: WhatsApp, звонок, Telegram, Instagram', async () => {
    const offer = await offerFor('alexey', undefined, 'en');
    expect(offer.options.map((o) => (o.kind === 'link' ? o.channel : o.kind))).toEqual([
      'whatsapp',
      'contact',
      'telegram',
      'instagram',
    ]);
    expect(offer.options.find((o) => o.kind === 'contact')).toEqual({
      kind: 'contact',
      phone: '+79990000001',
    });
  });

  it('«Любой» берёт контакты салона и не называет мастера', async () => {
    const offer = await offerFor('any', 'coloring-full', 'ru');
    expect(offer.message).not.toContain('Мастер:');
    expect(offer.message).toContain('Услуга:');
    expect(offer.options.find((o) => o.kind === 'contact')).toEqual({
      kind: 'contact',
      phone: '+79990000000',
    });
  });

  it('неизвестный мастер или услуга и несовпадение мастера с услугой дают undefined', async () => {
    const ctx = { t: translator('ru'), locale: 'ru' as const };
    expect(await provider.getOptions('ghost', undefined, ctx)).toBeUndefined();
    expect(await provider.getOptions('any', 'ghost', ctx)).toBeUndefined();
    // Алексей не делает окрашивание
    expect(await provider.getOptions('alexey', 'coloring-full', ctx)).toBeUndefined();
  });
});

describe('bookingScreen', () => {
  it('«Любой» и все мастера, затем «Назад» в меню', async () => {
    const masters = await repo.getMasters();
    const screen = bookingScreen(fakeCtx('ru'), 'ru', masters);
    expect(callbacks(screen.keyboard)).toEqual([
      'b:m:any',
      'b:m:alexey',
      'b:m:marina',
      'b:m:olga',
      'b:m:denis',
      'm',
      'm',
    ]);
    expect(labels(screen.keyboard)[0]).toBe('🎲 Любой мастер');
  });

  it('с услугой только её мастера, маршруты несут услугу, «Назад» в группу услуги', async () => {
    const service = await need(repo.getService('coloring-full'));
    const masters = (await repo.getMasters()).filter((m) => service.masterIds.includes(m.id));
    const screen = bookingScreen(fakeCtx('ru'), 'ru', masters, service);
    expect(callbacks(screen.keyboard)).toEqual([
      'b:m:any:coloring-full',
      'b:m:olga:coloring-full',
      's:g:coloring',
      'm',
    ]);
    expect(screen.text).toContain(service.title.ru);
  });
});

describe('bookingChannelsScreen', () => {
  it('мастер и услуга: текст на экране, ссылки, звонок, «Мастер не отвечает?»', async () => {
    const master = await need(repo.getMaster('olga'));
    const service = await need(repo.getService('coloring-full'));
    const offer = await offerFor('olga', 'coloring-full', 'ru');
    const screen = bookingChannelsScreen(fakeCtx('ru'), 'ru', { master, service, offer });
    expect(screen.text).toContain('Запись к мастеру: Ольга');
    expect(screen.text).toContain(master.contactHours.ru);
    expect(screen.text).toContain(offer.message);
    expect(labels(screen.keyboard)).toEqual([
      'WhatsApp',
      '📞 Позвонить',
      'Telegram',
      'Instagram',
      '😕 Мастер не отвечает?',
      '← Назад',
      '🏠 Главное меню',
    ]);
    expect(callbacks(screen.keyboard)).toEqual([
      'ms:call:olga',
      'b:nr:olga',
      'b:s:coloring-full',
      'm',
    ]);
    expect(urls(screen.keyboard)).toContain(`https://t.me/${master.contacts.telegram ?? ''}`);
  });

  it('без услуги «Назад» ведёт к выбору мастера', async () => {
    const master = await need(repo.getMaster('denis'));
    const offer = await offerFor('denis', undefined, 'en');
    const screen = bookingChannelsScreen(fakeCtx('en'), 'en', { master, offer });
    expect(callbacks(screen.keyboard)).toContain('b');
    expect(screen.text).toContain('Booking with: Denis');
  });

  it('«Любой»: звонок салону, без кнопки «не отвечает»', async () => {
    const offer = await offerFor('any', undefined, 'ru');
    const screen = bookingChannelsScreen(fakeCtx('ru'), 'ru', { offer });
    expect(screen.text).toContain('Запись в салон');
    expect(callbacks(screen.keyboard)).toEqual(['b:call', 'b', 'm']);
  });
});

describe('bookingNoReplyScreen', () => {
  it('часы связи, каналы мастера, общий контакт салона и «Назад» к каналам', async () => {
    const master = await need(repo.getMaster('marina'));
    const business = await repo.getBusiness();
    const masterOffer = await offerFor('marina', undefined, 'ru');
    const salonOffer = await offerFor('any', undefined, 'ru');
    const screen = bookingNoReplyScreen(fakeCtx('ru'), 'ru', {
      master,
      masterOffer,
      business,
      salonOffer,
    });
    expect(screen.text).toContain(master.contactHours.ru);
    expect(screen.text).toContain(business.contacts.phone ?? 'нет телефона');
    expect(callbacks(screen.keyboard)).toEqual(['ms:call:marina', 'b:call', 'b:m:marina', 'm']);
    expect(labels(screen.keyboard)).toContain('🏠 WhatsApp салона');
    expect(urls(screen.keyboard)).toContain(`https://t.me/${business.contacts.telegram ?? ''}`);
  });
});
