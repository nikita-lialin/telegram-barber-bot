import { beforeEach, describe, expect, it } from 'vitest';
import { clearPhotoCache } from '../../src/ui/render.js';
import { buttonTexts, callbackData, createTestBot } from '../helpers/test-bot.js';

beforeEach(() => clearPhotoCache());

const shown = (calls: ReturnType<typeof createTestBot>['calls']) =>
  calls.find((c) => c.method === 'editMessageText');
const stubShown = (calls: ReturnType<typeof createTestBot>['calls']) =>
  calls.some((c) => c.method === 'answerCallbackQuery' && c.payload['text']);

describe('сценарий 10: записаться', () => {
  it('меню → выбор мастера или «Любой» без заглушки', async () => {
    const t = createTestBot();
    await t.sendCallback('b', 'ru');
    const edit = shown(t.calls);
    expect(callbackData(edit?.payload['reply_markup'])).toEqual([
      'b:m:any',
      'b:m:alexey',
      'b:m:marina',
      'b:m:olga',
      'b:m:denis',
      'm',
      'm',
    ]);
    expect(stubShown(t.calls)).toBe(false);
  });

  it('мастер → каналы и готовый текст на экране', async () => {
    const t = createTestBot();
    await t.sendCallback('b:m:olga', 'ru');
    const edit = shown(t.calls);
    expect(String(edit?.payload['text'])).toContain(
      'Здравствуйте! Хочу записаться. Мастер: Ольга.',
    );
    const markup = edit?.payload['reply_markup'];
    expect(buttonTexts(markup)).toContain('WhatsApp');
    expect(buttonTexts(markup)).toContain('Instagram');
    expect(callbackData(markup)).toEqual(['ms:call:olga', 'b:nr:olga', 'b', 'm']);
  });

  it('из услуги: только мастера этой услуги, затем текст с мастером и услугой', async () => {
    const t = createTestBot();
    await t.sendCallback('b:s:coloring-full', 'ru');
    expect(callbackData(shown(t.calls)?.payload['reply_markup'])).toEqual([
      'b:m:any:coloring-full',
      'b:m:olga:coloring-full',
      's:g:coloring',
      'm',
    ]);

    t.calls.length = 0;
    await t.sendCallback('b:m:olga:coloring-full', 'ru');
    const text = String(shown(t.calls)?.payload['text']);
    expect(text).toContain('Мастер: Ольга.');
    expect(text).toContain('Услуга:');
  });

  it('кнопка [Записаться] из услуг и из карточки мастера работает', async () => {
    const t = createTestBot();
    await t.sendCallback('s:g:coloring', 'ru');
    const book = callbackData(shown(t.calls)?.payload['reply_markup'])[0] ?? '';
    expect(book).toBe('b:s:coloring-full');
    t.calls.length = 0;
    await t.sendCallback(book, 'ru');
    expect(shown(t.calls)).toBeDefined();
    expect(stubShown(t.calls)).toBe(false);

    t.calls.length = 0;
    await t.sendCallback('ms:c:alexey', 'ru');
    const photo = t.calls.find((c) => c.method === 'sendPhoto');
    const bookMaster = callbackData(photo?.payload['reply_markup'])[0] ?? '';
    expect(bookMaster).toBe('b:m:alexey');
    t.calls.length = 0;
    await t.sendCallback(bookMaster, 'ru', true);
    expect(String(t.calls.find((c) => c.method === 'sendMessage')?.payload['text'])).toContain(
      'Мастер: Алексей.',
    );
    expect(stubShown(t.calls)).toBe(false);
  });

  it('«Любой»: контакты салона, звонок присылает карточку контакта салона', async () => {
    const t = createTestBot();
    await t.sendCallback('b:m:any', 'ru');
    const edit = shown(t.calls);
    expect(String(edit?.payload['text'])).toContain('Запись в салон');
    expect(callbackData(edit?.payload['reply_markup'])).toEqual(['b:call', 'b', 'm']);

    t.calls.length = 0;
    await t.sendCallback('b:call', 'ru');
    const contact = t.calls.find((c) => c.method === 'sendContact');
    expect(contact?.payload).toMatchObject({ phone_number: '+79990000000' });
  });

  it('английский язык', async () => {
    const t = createTestBot();
    await t.sendCallback('b:m:denis', 'en');
    expect(String(shown(t.calls)?.payload['text'])).toContain(
      'Hello! I would like to book a visit. Master: Denis.',
    );
  });

  it('устаревшие и чужие маршруты уходят в «Кнопка устарела», а не в заглушку', async () => {
    for (const data of ['b:m:ghost', 'b:s:ghost', 'b:m:alexey:coloring-full', 'b:nr:ghost']) {
      const t = createTestBot();
      await t.sendCallback(data, 'ru');
      expect(stubShown(t.calls)).toBe(true);
      const answer = t.calls.find((c) => c.method === 'answerCallbackQuery');
      expect(answer?.payload['text']).toBe('Кнопка устарела');
    }
  });
});

describe('сценарий 11: нет ответа', () => {
  it('часы связи мастера, его каналы и общий контакт салона', async () => {
    const t = createTestBot();
    await t.sendCallback('b:nr:olga', 'ru');
    const edit = shown(t.calls);
    const text = String(edit?.payload['text']);
    expect(text).toContain('Вт–Сб 11:00–19:00');
    expect(text).toContain('+7 999 000-00-00');
    const markup = edit?.payload['reply_markup'];
    expect(callbackData(markup)).toEqual(['ms:call:olga', 'b:call', 'b:m:olga', 'm']);
    expect(buttonTexts(markup)).toEqual([
      'WhatsApp',
      '📞 Позвонить',
      'Telegram',
      'Instagram',
      '🏠 WhatsApp салона',
      '🏠 Позвонить в салон',
      '🏠 Telegram салона',
      '🏠 Instagram салона',
      '← Назад',
      '🏠 Главное меню',
    ]);
    expect(stubShown(t.calls)).toBe(false);
  });

  it('с экрана каналов есть переход в «Мастер не отвечает?»', async () => {
    const t = createTestBot();
    await t.sendCallback('b:m:marina', 'en');
    const markup = shown(t.calls)?.payload['reply_markup'];
    expect(buttonTexts(markup)).toContain('😕 Master not replying?');
    expect(callbackData(markup)).toContain('b:nr:marina');
  });
});
