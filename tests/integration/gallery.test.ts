import { beforeEach, describe, expect, it } from 'vitest';
import { clearPhotoCache } from '../../src/ui/render.js';
import { buttonTexts, callbackData, createTestBot } from '../helpers/test-bot.js';

beforeEach(() => clearPhotoCache());

const methods = (calls: Array<{ method: string }>) => calls.map((c) => c.method);
const noStub = (calls: Array<{ method: string; payload: Record<string, unknown> }>) =>
  !calls.some((c) => c.method === 'answerCallbackQuery' && c.payload['text']);

describe('сценарий 7: наши работы', () => {
  it('из главного меню: кнопка «Наши работы» ведёт на g', async () => {
    const t = createTestBot();
    await t.sendCommand('menu', 'ru');
    const menu = t.calls.find((c) => c.method === 'sendMessage');
    expect(callbackData(menu?.payload['reply_markup'])).toContain('g');
    expect(buttonTexts(menu?.payload['reply_markup'])).toContain('📸 Наши работы');
  });

  it('список категорий: текст заменяется текстом, без заглушки', async () => {
    const t = createTestBot();
    await t.sendCallback('g', 'ru');
    const edit = t.calls.find((c) => c.method === 'editMessageText');
    expect(String(edit?.payload['text'])).toContain('Выберите категорию');
    expect(callbackData(edit?.payload['reply_markup'])).toEqual([
      'g:p:men:0',
      'g:p:women:0',
      'g:p:kids:0',
      'g:p:coloring:0',
      'm',
      'm',
    ]);
    expect(noStub(t.calls)).toBe(true);
  });

  it('категория → фото: из текста новое сообщение с фото, старое удаляется после отправки', async () => {
    const t = createTestBot();
    await t.sendCallback('g:p:women:0', 'ru');
    const photo = t.calls.find((c) => c.method === 'sendPhoto');
    expect(photo).toBeDefined();
    expect(String(photo?.payload['caption'])).toContain('Каре с лёгкой укладкой');
    expect(callbackData(photo?.payload['reply_markup'])[0]).toBe('g:p:women:2');
    const order = methods(t.calls);
    expect(order.indexOf('sendPhoto')).toBeLessThan(order.indexOf('deleteMessage'));
    expect(noStub(t.calls)).toBe(true);
  });

  it('листание ◀ ▶ между фото: editMessageMedia, без нового сообщения', async () => {
    const t = createTestBot();
    await t.sendCallback('g:p:men:1', 'ru', true);
    const media = t.calls.find((c) => c.method === 'editMessageMedia');
    expect(media).toBeDefined();
    const input = media?.payload['media'] as { caption: string };
    expect(input.caption).toContain('Фейд и оформление бороды');
    expect(methods(t.calls)).not.toContain('sendPhoto');
    expect(methods(t.calls)).not.toContain('sendMessage');
    expect(methods(t.calls)).not.toContain('deleteMessage');
  });

  it('циклическая навигация: с первого фото ◀ идёт на последнее', async () => {
    const t = createTestBot();
    await t.sendCallback('g:p:coloring:0', 'ru', true);
    const first = t.calls.find((c) => c.method === 'editMessageMedia');
    const [prev, , next] = callbackData(first?.payload['reply_markup']);
    expect(prev).toBe('g:p:coloring:3');
    expect(next).toBe('g:p:coloring:1');
    t.calls.length = 0;
    await t.sendCallback('g:p:coloring:3', 'ru', true);
    const last = t.calls.find((c) => c.method === 'editMessageMedia');
    expect(callbackData(last?.payload['reply_markup']).slice(0, 3)).toEqual([
      'g:p:coloring:2',
      'noop',
      'g:p:coloring:0',
    ]);
  });

  it('переход в другую категорию с фото на фото', async () => {
    const t = createTestBot();
    await t.sendCallback('g:p:kids:0', 'ru', true);
    expect(methods(t.calls)).toContain('editMessageMedia');
    expect(methods(t.calls)).not.toContain('sendMessage');
  });

  it('«Назад» с фото возвращает текст категорий: новое сообщение, фото удаляется', async () => {
    const t = createTestBot();
    await t.sendCallback('g', 'ru', true);
    const sent = t.calls.find((c) => c.method === 'sendMessage');
    expect(String(sent?.payload['text'])).toContain('Выберите категорию');
    const order = methods(t.calls);
    expect(order.indexOf('sendMessage')).toBeLessThan(order.indexOf('deleteMessage'));
    expect(methods(t.calls)).not.toContain('editMessageText');
  });

  it('«Главное меню» с фото заменяет сообщение текстом', async () => {
    const t = createTestBot();
    await t.sendCallback('m', 'ru', true);
    expect(t.calls.find((c) => c.method === 'sendMessage')?.payload['text']).toBe('Главное меню');
    expect(methods(t.calls)).toContain('deleteMessage');
  });

  it('путь к записи: кнопка ведёт к мастеру работы, и маршрут работает', async () => {
    const t = createTestBot();
    await t.sendCallback('g:p:men:0', 'ru');
    const photo = t.calls.find((c) => c.method === 'sendPhoto');
    expect(callbackData(photo?.payload['reply_markup'])).toContain('b:m:alexey');
    t.calls.length = 0;
    await t.sendCallback('b:m:alexey', 'ru', true);
    expect(noStub(t.calls)).toBe(true);
    expect(methods(t.calls)).toContain('sendMessage');
  });

  it('английский язык: подписи и категории на английском', async () => {
    const t = createTestBot();
    await t.sendCallback('g:p:men:1', 'en');
    const photo = t.calls.find((c) => c.method === 'sendPhoto');
    expect(String(photo?.payload['caption'])).toContain('Fade and beard shaping');
    expect(buttonTexts(photo?.payload['reply_markup'])).toContain('Women');
  });

  it.each(['g:p:men:99', 'g:p:men:3', 'g:p:nobody:0', 'g:p:men:x', 'g:zzz'])(
    'устаревшая или битая кнопка %s: «Кнопка устарела» и меню, без падения',
    async (data) => {
      const t = createTestBot();
      await t.sendCallback(data, 'ru');
      const answer = t.calls.find((c) => c.method === 'answerCallbackQuery');
      expect(answer?.payload['text']).toBe('Кнопка устарела');
      expect(methods(t.calls)).toContain('editMessageText');
    },
  );

  it('устаревшая кнопка на экране с фото: меню новым сообщением', async () => {
    const t = createTestBot();
    await t.sendCallback('g:p:men:99', 'ru', true);
    const answer = t.calls.find((c) => c.method === 'answerCallbackQuery');
    expect(answer?.payload['text']).toBe('Кнопка устарела');
    expect(t.calls.find((c) => c.method === 'sendMessage')?.payload['text']).toBe('Главное меню');
  });

  it('заглушек больше нет ни у одного маршрута', async () => {
    const t = createTestBot();
    for (const data of ['s', 'ms', 'g', 'g:p:men:0', 'sch', 'loc', 'b']) {
      t.calls.length = 0;
      await t.sendCallback(data, 'ru');
      expect(noStub(t.calls), data).toBe(true);
    }
  });
});
