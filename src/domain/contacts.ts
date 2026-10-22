import type { Translate } from './translate.js';
import type { Contacts } from './types.js';

/** Ссылка wa.me: текст кодируется целиком, поэтому кириллица, пробелы и переводы строк безопасны. */
export function buildWhatsAppLink(number: string, message?: string): string {
  const base = `https://wa.me/${number}`;
  return message === undefined || message === ''
    ? base
    : `${base}?text=${encodeURIComponent(message)}`;
}

/** Ссылка на профиль: готовый текст t.me для личных аккаунтов не подставляет. */
export function buildTelegramLink(username: string): string {
  return `https://t.me/${username}`;
}

export function buildInstagramLink(username: string): string {
  return `https://instagram.com/${username}`;
}

/** '+7 999 000-00-01' → '+79990000001': такой формат ждёт sendContact. */
export function normalizePhone(phone: string): string {
  return `+${phone.replace(/\D/g, '')}`;
}

export interface MessageSubject {
  masterName?: string;
  serviceTitle?: string;
}

/** Готовое сообщение для мастера. Шаблоны лежат в .ftl, имя и услуга подставляются как есть. */
export function buildContactMessage(t: Translate, subject: MessageSubject = {}): string {
  const { masterName, serviceTitle } = subject;
  if (masterName !== undefined && serviceTitle !== undefined) {
    return t('contact-message-master-service', { master: masterName, service: serviceTitle });
  }
  if (masterName !== undefined) return t('contact-message-master', { master: masterName });
  if (serviceTitle !== undefined) return t('contact-message-service', { service: serviceTitle });
  return t('contact-message');
}

export interface ContactLinks {
  whatsapp?: string;
  telegram?: string;
  instagram?: string;
  /** Номер для sendContact; в ссылку не превращается, Telegram не поддерживает tel: в кнопках. */
  phone?: string;
}

/** Каналы связи, которые реально указаны у мастера или салона. */
export function buildContactLinks(contacts: Contacts, message?: string): ContactLinks {
  const links: ContactLinks = {};
  if (contacts.whatsapp !== undefined) {
    links.whatsapp = buildWhatsAppLink(contacts.whatsapp, message);
  }
  if (contacts.telegram !== undefined) links.telegram = buildTelegramLink(contacts.telegram);
  if (contacts.instagram !== undefined) links.instagram = buildInstagramLink(contacts.instagram);
  if (contacts.phone !== undefined) links.phone = normalizePhone(contacts.phone);
  return links;
}
