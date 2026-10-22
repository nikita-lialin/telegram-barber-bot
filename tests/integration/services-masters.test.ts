import { beforeEach, describe, expect, it } from 'vitest';
import { clearPhotoCache } from '../../src/ui/render.js';
import { buttonTexts, callbackData, createTestBot } from '../helpers/test-bot.js';

const plain = (value: unknown) => String(value).replaceAll(' ', ' ');

beforeEach(() => clearPhotoCache());

describe('сценарий 5: услуги и цены', () => {
  it('группы → услуги группы с ценой и длительностью', async () => {
    const t = createTestBot();
    await t.sendCallback('s', 'ru');
    const groups = t.calls.find((c) => c.method === 'editMessageText');
    expect(callbackData(groups?.payload['reply_markup'])).toEqual([
      's:g:men',
      's:g:women',
      's:g:kids',
      's:g:coloring',
      'm',
      'm',
    ]);

    t.calls.length = 0;
    await t.sendCallback('s:g:women', 'ru');
    const edit = t.calls.find((c) => c.method === 'editMessageText');
    const text = plain(edit?.payload['text']);
    expect(text).toContain('• Стрижка — 2 500 ₽, 60 мин');
    expect(text).toContain('• Укладка — 1 800 ₽, 45 мин');
    expect(callbackData(edit?.payload['reply_markup'])).toEqual(['b', 'ms:f:women', 's', 'm']);
    // раздел не отвечает заглушкой
    expect(t.calls.some((c) => c.method === 'answerCallbackQuery' && c.payload['text'])).toBe(
      false,
    );
  });

  it('те же экраны на английском', async () => {
    const t = createTestBot();
    await t.sendCallback('s:g:men', 'en');
    const edit = t.calls.find((c) => c.method === 'editMessageText');
    expect(plain(edit?.payload['text'])).toContain('• Haircut — 1 500 ₽, 45 min');
  });

  it('все цены в разделе берутся из data/services.json', async () => {
    const t = createTestBot();
    const seen: string[] = [];
    for (const group of ['men', 'women', 'kids', 'coloring']) {
      t.calls.length = 0;
      await t.sendCallback(`s:g:${group}`, 'ru');
      seen.push(plain(t.calls.find((c) => c.method === 'editMessageText')?.payload['text']));
    }
    const all = seen.join('\n');
    for (const price of [
      '1 500 ₽',
      '800 ₽',
      '2 100 ₽',
      '2 500 ₽',
      '1 800 ₽',
      '1 000 ₽',
      '4 500 ₽',
    ]) {
      expect(all).toContain(price);
    }
  });
});

describe('сценарий 6: нетипичная работа', () => {
  it('«от», подсказка и путь к мастеру', async () => {
    const t = createTestBot();
    await t.sendCallback('s:g:coloring', 'ru');
    const edit = t.calls.find((c) => c.method === 'editMessageText');
    const text = plain(edit?.payload['text']);
    expect(text).toContain('от 4 500 ₽');
    expect(text).toContain('2–4 ч');
    expect(text).toContain('Стоимость уточняйте у мастера');
    const markup = edit?.payload['reply_markup'];
    expect(buttonTexts(markup)).toContain('💬 Спросить мастера');
    expect(callbackData(markup)).toContain('b:s:coloring-full');

    // «Спросить мастера» ведёт к мастеру, который делает окрашивание
    t.calls.length = 0;
    await t.sendCallback('ms:f:coloring', 'ru');
    const filtered = t.calls.find((c) => c.method === 'editMessageText');
    const buttons = callbackData(filtered?.payload['reply_markup']);
    expect(buttons.filter((d) => d.startsWith('ms:c:'))).toEqual(['ms:c:olga']);
  });
});

describe('сценарий 3: узнать о команде', () => {
  it('список из 4 мастеров', async () => {
    const t = createTestBot();
    await t.sendCallback('ms', 'ru');
    const edit = t.calls.find((c) => c.method === 'editMessageText');
    const cards = callbackData(edit?.payload['reply_markup']).filter((d) => d.startsWith('ms:c:'));
    expect(cards).toEqual(['ms:c:alexey', 'ms:c:marina', 'ms:c:olga', 'ms:c:denis']);
  });

  it('карточка: новое сообщение с фото, старый текст удаляется', async () => {
    const t = createTestBot();
    await t.sendCallback('ms:c:olga', 'ru');
    const photo = t.calls.find((c) => c.method === 'sendPhoto');
    expect(photo).toBeDefined();
    expect(String(photo?.payload['caption'])).toContain('Ольга');
    expect(String(photo?.payload['caption'])).toContain('Вт–Сб 11:00–19:00');
    expect(t.calls.some((c) => c.method === 'editMessageText')).toBe(false);

    const del = t.calls.find((c) => c.method === 'deleteMessage');
    expect(del?.payload).toMatchObject({ chat_id: 1, message_id: 100 });
    const order = t.calls.map((c) => c.method);
    expect(order.indexOf('sendPhoto')).toBeLessThan(order.indexOf('deleteMessage'));

    const markup = photo?.payload['reply_markup'];
    expect(callbackData(markup)).toEqual(['b:m:olga', 'ms:call:olga', 'ms', 'm']);
    expect(buttonTexts(markup)).toEqual([
      '✂️ Записаться',
      'WhatsApp',
      '📞 Позвонить',
      'Telegram',
      'Instagram',
      '← Назад',
      '🏠 Главное меню',
    ]);
  });

  it('«Назад» из карточки возвращает список текстом и убирает фото', async () => {
    const t = createTestBot();
    await t.sendCallback('ms', 'ru', true);
    expect(t.calls.some((c) => c.method === 'sendMessage')).toBe(true);
    expect(t.calls.some((c) => c.method === 'deleteMessage')).toBe(true);
    expect(t.calls.some((c) => c.method === 'editMessageText')).toBe(false);
  });

  it('«Главное меню» из карточки тоже заменяет фото текстом', async () => {
    const t = createTestBot();
    await t.sendCallback('m', 'ru', true);
    const sent = t.calls.find((c) => c.method === 'sendMessage');
    expect(sent?.payload['text']).toBe('Главное меню');
    expect(t.calls.some((c) => c.method === 'deleteMessage')).toBe(true);
  });

  it('второй показ той же карточки идёт по file_id', async () => {
    const t = createTestBot();
    await t.sendCallback('ms:c:olga', 'ru');
    await t.sendCallback('ms:c:olga', 'ru');
    const photos = t.calls.filter((c) => c.method === 'sendPhoto');
    expect(photos).toHaveLength(2);
    expect(photos[1]?.payload['photo']).toBe('FILE-ID');
  });

  it('ссылка WhatsApp содержит готовое сообщение с кириллицей', async () => {
    const t = createTestBot();
    await t.sendCallback('ms:c:olga', 'ru');
    const photo = t.calls.find((c) => c.method === 'sendPhoto');
    const markup = photo?.payload['reply_markup'] as {
      inline_keyboard: Array<Array<{ url?: string }>>;
    };
    const wa = markup.inline_keyboard.flat().find((b) => b.url?.includes('wa.me'));
    expect(wa?.url).toMatch(/^https:\/\/wa\.me\/79990000003\?text=/);
    expect(wa?.url).not.toMatch(/[А-Яа-я]/);
    expect(new URL(wa!.url!).searchParams.get('text')).toBe(
      'Здравствуйте! Хочу записаться. Мастер: Ольга.',
    );
  });

  it('«Позвонить» присылает карточку контакта', async () => {
    const t = createTestBot();
    await t.sendCallback('ms:call:olga', 'ru', true);
    const contact = t.calls.find((c) => c.method === 'sendContact');
    expect(contact?.payload).toMatchObject({ phone_number: '+79990000003', first_name: 'Ольга' });
    // экран с карточкой остаётся на месте
    expect(t.calls.some((c) => c.method === 'deleteMessage')).toBe(false);
    expect(t.calls.some((c) => c.method === 'editMessageMedia')).toBe(false);
  });

  it('английская карточка', async () => {
    const t = createTestBot();
    await t.sendCallback('ms:c:alexey', 'en');
    const photo = t.calls.find((c) => c.method === 'sendPhoto');
    expect(String(photo?.payload['caption'])).toContain('Alexey');
    expect(String(photo?.payload['caption'])).toContain('Mon–Fri 10:00–19:00');
    expect(buttonTexts(photo?.payload['reply_markup'])).toContain('📞 Call');
  });
});

describe('сценарий 4: мастер по задаче', () => {
  it.each([
    ['men', 'alexey'],
    ['women', 'marina'],
    ['kids', 'denis'],
    ['coloring', 'olga'],
  ])('группа %s даёт мастера %s', async (group, masterId) => {
    const t = createTestBot();
    await t.sendCallback(`ms:f:${group}`, 'ru');
    const edit = t.calls.find((c) => c.method === 'editMessageText');
    const markup = edit?.payload['reply_markup'];
    expect(callbackData(markup).filter((d) => d.startsWith('ms:c:'))).toEqual([`ms:c:${masterId}`]);
    // фильтр можно снять, не возвращаясь в меню
    expect(callbackData(markup)).toContain('ms');
  });
});

describe('остальные разделы и устаревшие кнопки', () => {
  it('запись и галерея пока отвечают заглушкой', async () => {
    const t = createTestBot();
    for (const data of ['b:m:olga', 'b:s:coloring-full', 'b', 'g']) {
      t.calls.length = 0;
      await t.sendCallback(data, 'ru');
      const answer = t.calls.find((c) => c.method === 'answerCallbackQuery');
      expect(answer?.payload['text'], data).toBe('Раздел скоро появится');
    }
  });

  it('неизвестный мастер даёт «Кнопка устарела» и меню', async () => {
    const t = createTestBot();
    await t.sendCallback('ms:c:nobody', 'ru');
    const answer = t.calls.find((c) => c.method === 'answerCallbackQuery');
    expect(answer?.payload['text']).toBe('Кнопка устарела');
    expect(t.calls.some((c) => c.method === 'editMessageText')).toBe(true);
  });
});
