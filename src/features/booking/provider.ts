import type { CatalogRepository } from '../../data/repository.js';
import { buildContactLinks, buildContactMessage } from '../../domain/contacts.js';
import type { Translate } from '../../domain/translate.js';
import type { Locale } from '../../domain/types.js';
import { pick } from '../../i18n/index.js';
import { ANY_MASTER } from '../../ui/callback.js';

export type BookingChannel = 'whatsapp' | 'telegram' | 'instagram';

export type BookingOption =
  { kind: 'link'; channel: BookingChannel; url: string } | { kind: 'contact'; phone: string };

/** Язык и перевод нужны, чтобы собрать готовый текст сообщения и вставить его в ссылку WhatsApp. */
export interface BookingContext {
  t: Translate;
  locale: Locale;
}

export interface BookingOffer {
  /** Готовый текст сообщения: его же экран показывает для копирования. */
  message: string;
  options: BookingOption[];
}

export interface BookingProvider {
  /**
   * Как записаться к мастеру (или в салон при `ANY_MASTER`) на услугу.
   * Возвращает undefined, если мастера или услуги нет, или мастер услугу не выполняет.
   */
  getOptions(
    masterId: string,
    serviceId: string | undefined,
    context: BookingContext,
  ): Promise<BookingOffer | undefined>;
}

/** Запись через внешние каналы: WhatsApp, звонок, Telegram, Instagram. */
export class ExternalLinksBookingProvider implements BookingProvider {
  constructor(private readonly catalog: CatalogRepository) {}

  async getOptions(
    masterId: string,
    serviceId: string | undefined,
    { t, locale }: BookingContext,
  ): Promise<BookingOffer | undefined> {
    const service = serviceId === undefined ? undefined : await this.catalog.getService(serviceId);
    if (serviceId !== undefined && service === undefined) return undefined;

    const master = masterId === ANY_MASTER ? undefined : await this.catalog.getMaster(masterId);
    if (masterId !== ANY_MASTER) {
      if (master === undefined) return undefined;
      if (service !== undefined && !service.masterIds.includes(master.id)) return undefined;
    }

    const contacts = master?.contacts ?? (await this.catalog.getBusiness()).contacts;
    const message = buildContactMessage(t, {
      ...(master === undefined ? {} : { masterName: pick(master.name, locale) }),
      ...(service === undefined ? {} : { serviceTitle: pick(service.title, locale) }),
    });
    const links = buildContactLinks(contacts, message);

    const options: BookingOption[] = [];
    if (links.whatsapp !== undefined) {
      options.push({ kind: 'link', channel: 'whatsapp', url: links.whatsapp });
    }
    if (links.phone !== undefined) options.push({ kind: 'contact', phone: links.phone });
    if (links.telegram !== undefined) {
      options.push({ kind: 'link', channel: 'telegram', url: links.telegram });
    }
    if (links.instagram !== undefined) {
      options.push({ kind: 'link', channel: 'instagram', url: links.instagram });
    }
    return { message, options };
  }
}
