import { describe, expect, it } from 'vitest';
import { callbackData, createTestBot } from '../helpers/test-bot.js';

const MENU_ROUTES = ['s', 'ms', 'g', 'sch', 'loc', 'b'];

describe('/start', () => {
  it('показывает приветствие и меню на русском для language_code ru', async () => {
    const t = createTestBot();
    await t.sendCommand('start', 'ru');

    expect(t.calls).toHaveLength(1);
    const [call] = t.calls;
    expect(call?.method).toBe('sendMessage');
    expect(call?.payload['text']).toContain('Добро пожаловать');
    expect(call?.payload['text']).toContain('Главное меню');
    expect(callbackData(call?.payload['reply_markup'])).toEqual([...MENU_ROUTES, 'l:en']);
  });

  it('показывает меню на английском для остальных языков и без language_code', async () => {
    for (const code of ['en', 'de', undefined]) {
      const t = createTestBot();
      await t.sendCommand('start', code);
      expect(t.calls[0]?.payload['text']).toContain('Welcome');
      expect(callbackData(t.calls[0]?.payload['reply_markup'])).toContain('l:ru');
    }
  });

  it('запоминает язык в сессии', async () => {
    const t = createTestBot();
    await t.sendCommand('start', 'ru');
    expect(await t.sessions.read('1')).toEqual({ locale: 'ru' });
  });

  it('игнорирует группы', async () => {
    const t = createTestBot();
    await t.sendCommand('start', 'ru', 'group');
    expect(t.calls).toHaveLength(0);
  });
});

describe('меню и язык', () => {
  it('кнопка языка переключает меню на другой язык и запоминает выбор', async () => {
    const t = createTestBot();
    await t.sendCommand('start', 'ru');
    t.calls.length = 0;

    await t.sendCallback('l:en', 'ru');
    const edit = t.calls.find((c) => c.method === 'editMessageText');
    expect(edit?.payload['text']).toBe('Main menu');
    expect(callbackData(edit?.payload['reply_markup'])).toContain('l:ru');
    expect(await t.sessions.read('1')).toEqual({ locale: 'en' });

    // выбранный язык сильнее language_code из Telegram
    t.calls.length = 0;
    await t.sendCommand('menu', 'ru');
    expect(t.calls[0]?.payload['text']).toBe('Main menu');
  });

  it('/menu и /help отвечают одним сообщением с кнопкой меню', async () => {
    const t = createTestBot();
    await t.sendCommand('menu', 'ru');
    await t.sendCommand('help', 'ru');
    expect(t.calls.map((c) => c.method)).toEqual(['sendMessage', 'sendMessage']);
    expect(t.calls[0]?.payload['text']).toBe('Главное меню');
    expect(callbackData(t.calls[1]?.payload['reply_markup'])).toEqual(['m']);
  });

  it('кнопки разделов пока отвечают заглушкой', async () => {
    const t = createTestBot();
    await t.sendCallback('s', 'ru');
    const answer = t.calls.find((c) => c.method === 'answerCallbackQuery');
    expect(answer?.payload['text']).toBe('Раздел скоро появится');
  });

  it('устаревшая кнопка возвращает в меню', async () => {
    const t = createTestBot();
    await t.sendCallback('zzz:unknown', 'en');
    const answer = t.calls.find((c) => c.method === 'answerCallbackQuery');
    expect(answer?.payload['text']).toBe('This button is out of date');
    expect(t.calls.some((c) => c.method === 'editMessageText')).toBe(true);
  });
});
