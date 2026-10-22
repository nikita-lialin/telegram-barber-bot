import { describe, expect, it } from 'vitest';
import { callbackData, createTestBot, messages } from '../helpers/test-bot.js';

const T0 = new Date('2026-01-01T12:00:00Z');
const after = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

describe('непонятный ввод', () => {
  it('на каждый тип сообщения даёт подсказку с кнопкой «Главное меню»', async () => {
    for (const content of [
      messages.text('привет'),
      messages.sticker(),
      messages.photo(),
      messages.voice(),
      messages.document(),
    ]) {
      const t = createTestBot({ now: T0 });
      await t.sendMessage(content, { languageCode: 'ru' });

      expect(t.calls).toHaveLength(1);
      expect(t.calls[0]?.method).toBe('sendMessage');
      expect(t.calls[0]?.payload['text']).toBe('Я понимаю только кнопки меню.');
      expect(callbackData(t.calls[0]?.payload['reply_markup'])).toEqual(['m']);
    }
  });

  it('язык берётся из сессии', async () => {
    const t = createTestBot({ now: T0 });
    await t.sendMessage(messages.text('hi'), { languageCode: 'en' });
    expect(t.calls[0]?.payload['text']).toBe('I only understand the menu buttons.');
  });

  it('второе сообщение через 10 с игнорируется, через 31 с снова даёт подсказку', async () => {
    const t = createTestBot({ now: T0 });
    await t.sendMessage(messages.text('a'), { languageCode: 'ru' });
    t.setNow(after(10));
    await t.sendMessage(messages.sticker(), { languageCode: 'ru' });
    expect(t.calls).toHaveLength(1);

    t.setNow(after(31));
    await t.sendMessage(messages.photo(), { languageCode: 'ru' });
    expect(t.calls).toHaveLength(2);
  });

  it('границы 29 и 30 с', async () => {
    const t = createTestBot({ now: T0 });
    await t.sendMessage(messages.text('a'), { languageCode: 'ru' });
    t.setNow(after(29));
    await t.sendMessage(messages.text('b'), { languageCode: 'ru' });
    expect(t.calls).toHaveLength(1);
    t.setNow(after(30));
    await t.sendMessage(messages.text('c'), { languageCode: 'ru' });
    expect(t.calls).toHaveLength(2);
  });

  it('лимиты разных пользователей независимы', async () => {
    const t = createTestBot({ now: T0 });
    await t.sendMessage(messages.text('a'), { userId: 1, languageCode: 'ru' });
    t.setNow(after(5));
    await t.sendMessage(messages.text('b'), { userId: 2, languageCode: 'ru' });
    await t.sendMessage(messages.text('c'), { userId: 1, languageCode: 'ru' });
    expect(t.calls).toHaveLength(2);
  });

  it('команды /start, /menu, /help не перехватываются', async () => {
    const t = createTestBot({ now: T0 });
    await t.sendCommand('start', 'ru');
    await t.sendCommand('menu', 'ru');
    await t.sendCommand('help', 'ru');

    expect(t.calls).toHaveLength(3);
    for (const call of t.calls) {
      expect(call.payload['text']).not.toBe('Я понимаю только кнопки меню.');
    }
  });

  it('подсказка не отнимает у команд лимит: команда после подсказки отвечает сразу', async () => {
    const t = createTestBot({ now: T0 });
    await t.sendMessage(messages.text('a'), { languageCode: 'ru' });
    await t.sendCommand('menu', 'ru');
    expect(t.calls).toHaveLength(2);
  });

  it('группы отсекает privateOnly: ответа нет', async () => {
    for (const chatType of ['group', 'supergroup', 'channel']) {
      const t = createTestBot({ now: T0 });
      await t.sendMessage(messages.text('привет'), { chatType });
      expect(t.calls, chatType).toHaveLength(0);
    }
  });

  it('устаревшая кнопка работает как раньше', async () => {
    const t = createTestBot({ now: T0 });
    await t.sendCallback('zzz-unknown', 'ru');

    expect(t.calls[0]?.method).toBe('answerCallbackQuery');
    expect(t.calls[0]?.payload['text']).toBe('Кнопка устарела');
  });
});
