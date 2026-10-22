import { describe, expect, it } from 'vitest';
import {
  buildContactLinks,
  buildContactMessage,
  buildInstagramLink,
  buildTelegramLink,
  buildWhatsAppLink,
  normalizePhone,
} from '../../src/domain/contacts.js';
import type { Translate } from '../../src/domain/translate.js';

describe('ссылки', () => {
  it('WhatsApp кодирует кириллицу, пробелы и переводы строк', () => {
    const message = 'Здравствуйте! Хочу записаться.\nМастер: Ольга';
    const link = buildWhatsAppLink('79990000003', message);
    expect(link.startsWith('https://wa.me/79990000003?text=')).toBe(true);
    expect(link).not.toMatch(/[А-Яа-я \n]/);
    expect(new URL(link).searchParams.get('text')).toBe(message);
  });

  it('WhatsApp без текста даёт чистую ссылку', () => {
    expect(buildWhatsAppLink('79990000003')).toBe('https://wa.me/79990000003');
    expect(buildWhatsAppLink('79990000003', '')).toBe('https://wa.me/79990000003');
  });

  it('символы & и # в тексте не ломают параметр', () => {
    const link = buildWhatsAppLink('79990000003', 'Стрижка & борода #1');
    expect(new URL(link).searchParams.get('text')).toBe('Стрижка & борода #1');
  });

  it('Telegram, Instagram и телефон', () => {
    expect(buildTelegramLink('barber_olga_demo')).toBe('https://t.me/barber_olga_demo');
    expect(buildInstagramLink('olga.color.demo')).toBe('https://instagram.com/olga.color.demo');
    expect(normalizePhone('+7 999 000-00-01')).toBe('+79990000001');
  });
});

describe('шаблон сообщения', () => {
  const t: Translate = (key, params) => `${key}:${JSON.stringify(params ?? {})}`;

  it('выбирает шаблон по тому, что известно', () => {
    expect(buildContactMessage(t)).toBe('contact-message:{}');
    expect(buildContactMessage(t, { masterName: 'Ольга' })).toBe(
      'contact-message-master:{"master":"Ольга"}',
    );
    expect(buildContactMessage(t, { serviceTitle: 'Стрижка' })).toBe(
      'contact-message-service:{"service":"Стрижка"}',
    );
    expect(buildContactMessage(t, { masterName: 'Ольга', serviceTitle: 'Окрашивание' })).toBe(
      'contact-message-master-service:{"master":"Ольга","service":"Окрашивание"}',
    );
  });
});

describe('buildContactLinks', () => {
  it('возвращает только указанные каналы', () => {
    expect(buildContactLinks({ telegram: 'barber_olga_demo' })).toEqual({
      telegram: 'https://t.me/barber_olga_demo',
    });
    const all = buildContactLinks(
      {
        whatsapp: '79990000003',
        phone: '+7 999 000-00-03',
        telegram: 'barber_olga_demo',
        instagram: 'olga.color.demo',
      },
      'Привет',
    );
    expect(Object.keys(all).sort()).toEqual(['instagram', 'phone', 'telegram', 'whatsapp']);
    expect(all.phone).toBe('+79990000003');
    expect(all.whatsapp).toContain('?text=');
  });
});
