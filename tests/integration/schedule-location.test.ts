import { beforeEach, describe, expect, it } from 'vitest';
import { clearPhotoCache } from '../../src/ui/render.js';
import { buttonTexts, callbackData, createTestBot } from '../helpers/test-bot.js';

beforeEach(() => clearPhotoCache());

const THU_NOON = new Date('2026-10-22T09:00:00Z'); // 12:00 МСК
const THU_NIGHT = new Date('2026-10-22T19:00:00Z'); // 22:00 МСК

const noStub = (calls: Array<{ method: string; payload: Record<string, unknown> }>) =>
  !calls.some((c) => c.method === 'answerCallbackQuery' && c.payload['text']);

describe('сценарий 8: график работы', () => {
  it('открыто: редактирует текст, без заглушки', async () => {
    const t = createTestBot({ now: THU_NOON });
    await t.sendCallback('sch', 'ru');
    const edit = t.calls.find((c) => c.method === 'editMessageText');
    const text = String(edit?.payload['text']);
    expect(text).toContain('🟢 Сейчас открыто, до 20:00');
    expect(text).toContain('Пн–Пт: 10:00–20:00');
    expect(text).toContain('Сб: 10:00–18:00');
    expect(text).toContain('Вс: 11:00–16:00');
    expect(callbackData(edit?.payload['reply_markup'])).toEqual(['b', 'm', 'm']);
    expect(noStub(t.calls)).toBe(true);
  });

  it('закрыто: ближайшее открытие', async () => {
    const t = createTestBot({ now: THU_NIGHT });
    await t.sendCallback('sch', 'ru');
    const edit = t.calls.find((c) => c.method === 'editMessageText');
    expect(String(edit?.payload['text'])).toContain('🔴 Сейчас закрыто\nОткроемся завтра в 10:00');
  });

  it('английский язык', async () => {
    const t = createTestBot({ now: THU_NOON });
    await t.sendCallback('sch', 'en');
    const edit = t.calls.find((c) => c.method === 'editMessageText');
    expect(String(edit?.payload['text'])).toContain('🟢 Open now, until 20:00');
  });

  it('из главного меню: кнопка «График работы» ведёт на sch', async () => {
    const t = createTestBot({ now: THU_NOON });
    await t.sendCommand('menu', 'ru');
    const menu = t.calls.find((c) => c.method === 'sendMessage');
    expect(callbackData(menu?.payload['reply_markup'])).toContain('sch');
    expect(buttonTexts(menu?.payload['reply_markup'])).toContain('🕒 График работы');
  });

  it('путь к записи: кнопка ведёт на маршрут b', async () => {
    const t = createTestBot({ now: THU_NOON });
    await t.sendCallback('sch', 'ru');
    t.calls.length = 0;
    await t.sendCallback('b', 'ru');
    expect(t.calls.some((c) => c.method === 'editMessageText')).toBe(true);
  });
});

describe('сценарий 9: как нас найти', () => {
  it('из текста: новое сообщение с фото, старое удаляется после отправки', async () => {
    const t = createTestBot();
    await t.sendCallback('loc', 'ru');
    const photo = t.calls.find((c) => c.method === 'sendPhoto');
    expect(photo).toBeDefined();
    const caption = String(photo?.payload['caption']);
    expect(caption).toContain('Москва, ул. Примерная, д. 1');
    expect(caption).toContain('синяя дверь рядом с аптекой');
    expect(t.calls.some((c) => c.method === 'sendVenue')).toBe(false);

    const order = t.calls.map((c) => c.method);
    expect(order.indexOf('sendPhoto')).toBeLessThan(order.indexOf('deleteMessage'));
    expect(t.calls.find((c) => c.method === 'deleteMessage')?.payload).toMatchObject({
      chat_id: 1,
      message_id: 100,
    });
    expect(noStub(t.calls)).toBe(true);

    const markup = photo?.payload['reply_markup'] as {
      inline_keyboard: Array<Array<{ url?: string }>>;
    };
    const links = markup.inline_keyboard.flat().flatMap((b) => (b.url ? [b.url] : []));
    expect(links).toEqual([
      expect.stringContaining('yandex.ru/maps'),
      expect.stringContaining('google.com/maps'),
    ]);
    expect(callbackData(markup)).toEqual(['b', 'm', 'm']);
  });

  it('повторное нажатие на экране с фото редактирует медиа', async () => {
    const t = createTestBot();
    await t.sendCallback('loc', 'ru', true);
    expect(t.calls.some((c) => c.method === 'editMessageMedia')).toBe(true);
    expect(t.calls.some((c) => c.method === 'deleteMessage')).toBe(false);
  });

  it('«Главное меню» с экрана с фото заменяет сообщение текстом', async () => {
    const t = createTestBot();
    await t.sendCallback('m', 'ru', true);
    const sent = t.calls.find((c) => c.method === 'sendMessage');
    expect(sent?.payload['text']).toBe('Главное меню');
    expect(t.calls.some((c) => c.method === 'deleteMessage')).toBe(true);
    expect(t.calls.some((c) => c.method === 'editMessageText')).toBe(false);
  });

  it('«Записаться» с экрана с фото заменяет сообщение текстом', async () => {
    const t = createTestBot();
    await t.sendCallback('b', 'ru', true);
    expect(t.calls.some((c) => c.method === 'sendMessage')).toBe(true);
    expect(t.calls.some((c) => c.method === 'deleteMessage')).toBe(true);
  });

  it('английский язык', async () => {
    const t = createTestBot();
    await t.sendCallback('loc', 'en');
    const photo = t.calls.find((c) => c.method === 'sendPhoto');
    expect(String(photo?.payload['caption'])).toContain('1 Primernaya St, Moscow');
    expect(buttonTexts(photo?.payload['reply_markup'])).toContain('🗺 Google Maps');
  });
});
