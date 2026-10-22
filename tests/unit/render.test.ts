import { GrammyError, InlineKeyboard } from 'grammy';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../../src/context.js';
import { clearPhotoCache, renderScreen, type Screen } from '../../src/ui/render.js';

const textScreen: Screen = { text: 'text', keyboard: new InlineKeyboard() };
const photoScreen: Screen = {
  text: 'caption',
  keyboard: new InlineKeyboard(),
  photo: 'masters/olga.png',
};
const sentPhoto = { message_id: 7, photo: [{ file_id: 'ID-1' }] };

function fakeCtx(current: 'none' | 'text' | 'photo', overrides: Record<string, unknown> = {}) {
  const calls = {
    editMessageText: vi.fn().mockResolvedValue(true),
    editMessageMedia: vi.fn().mockResolvedValue(sentPhoto),
    reply: vi.fn().mockResolvedValue({ message_id: 7 }),
    replyWithPhoto: vi.fn().mockResolvedValue(sentPhoto),
    deleteMessage: vi.fn().mockResolvedValue(true),
  };
  const message =
    current === 'photo'
      ? { message_id: 5, chat: { id: 1 }, photo: [{ file_id: 'OLD' }] }
      : { message_id: 5, chat: { id: 1 }, text: 'old' };
  const ctx = {
    ...(current === 'none' ? {} : { callbackQuery: { message } }),
    ...calls,
    api: { deleteMessage: calls.deleteMessage },
    ...overrides,
  } as unknown as BotContext;
  return { ctx, calls };
}

beforeEach(() => clearPhotoCache());

describe('renderScreen: таблица переходов', () => {
  it('команда: всегда новое сообщение', async () => {
    const a = fakeCtx('none');
    await renderScreen(a.ctx, textScreen);
    expect(a.calls.reply).toHaveBeenCalledOnce();

    const b = fakeCtx('none');
    await renderScreen(b.ctx, photoScreen);
    expect(b.calls.replyWithPhoto).toHaveBeenCalledOnce();
    expect(b.calls.deleteMessage).not.toHaveBeenCalled();
  });

  it('текст → текст: editMessageText', async () => {
    const { ctx, calls } = fakeCtx('text');
    await renderScreen(ctx, textScreen);
    expect(calls.editMessageText).toHaveBeenCalledOnce();
    expect(calls.reply).not.toHaveBeenCalled();
    expect(calls.deleteMessage).not.toHaveBeenCalled();
  });

  it('фото → фото: editMessageMedia с подписью', async () => {
    const { ctx, calls } = fakeCtx('photo');
    await renderScreen(ctx, photoScreen);
    expect(calls.editMessageMedia).toHaveBeenCalledOnce();
    expect(calls.editMessageMedia.mock.calls[0]?.[0]).toMatchObject({
      type: 'photo',
      caption: 'caption',
    });
    expect(calls.replyWithPhoto).not.toHaveBeenCalled();
  });

  it('текст → фото: новое сообщение, потом удаление старого', async () => {
    const { ctx, calls } = fakeCtx('text');
    await renderScreen(ctx, photoScreen);
    expect(calls.replyWithPhoto).toHaveBeenCalledOnce();
    expect(calls.deleteMessage).toHaveBeenCalledWith(1, 5);
    expect(calls.replyWithPhoto.mock.invocationCallOrder[0]).toBeLessThan(
      calls.deleteMessage.mock.invocationCallOrder[0]!,
    );
  });

  it('фото → текст: новое сообщение, потом удаление старого', async () => {
    const { ctx, calls } = fakeCtx('photo');
    await renderScreen(ctx, textScreen);
    expect(calls.reply).toHaveBeenCalledOnce();
    expect(calls.deleteMessage).toHaveBeenCalledWith(1, 5);
  });

  it('старое сообщение не удаляется, если новое не отправилось', async () => {
    const { ctx, calls } = fakeCtx('text', {
      replyWithPhoto: vi.fn().mockRejectedValue(new Error('network')),
    });
    await expect(renderScreen(ctx, photoScreen)).rejects.toThrow('network');
    expect(calls.deleteMessage).not.toHaveBeenCalled();
  });

  it('ошибка удаления старого сообщения не ломает показ экрана', async () => {
    const { ctx } = fakeCtx('text', {
      api: { deleteMessage: vi.fn().mockRejectedValue(new Error("can't be deleted")) },
    });
    await expect(renderScreen(ctx, photoScreen)).resolves.toBeUndefined();
  });
});

describe('renderScreen: ошибки Telegram', () => {
  const grammyError = (description: string) =>
    new GrammyError('x', { ok: false, error_code: 400, description }, 'm', {});

  it('«message is not modified» молча игнорируется', async () => {
    const { ctx, calls } = fakeCtx('text', {
      editMessageText: vi
        .fn()
        .mockRejectedValue(grammyError('Bad Request: message is not modified')),
    });
    await renderScreen(ctx, textScreen);
    expect(calls.reply).not.toHaveBeenCalled();
  });

  it('«message to edit not found» заменяется новым сообщением', async () => {
    const { ctx, calls } = fakeCtx('text', {
      editMessageText: vi
        .fn()
        .mockRejectedValue(grammyError('Bad Request: message to edit not found')),
    });
    await renderScreen(ctx, textScreen);
    expect(calls.reply).toHaveBeenCalledOnce();
  });

  it('прочие ошибки пробрасываются', async () => {
    const { ctx } = fakeCtx('text', {
      editMessageText: vi.fn().mockRejectedValue(grammyError('Bad Request: chat not found')),
    });
    await expect(renderScreen(ctx, textScreen)).rejects.toThrow();
  });
});

describe('renderScreen: кэш file_id', () => {
  it('после первой отправки фото уходит по file_id', async () => {
    const first = fakeCtx('none');
    await renderScreen(first.ctx, photoScreen);
    expect(first.calls.replyWithPhoto.mock.calls[0]?.[0]).not.toBe('ID-1');

    const second = fakeCtx('none');
    await renderScreen(second.ctx, photoScreen);
    expect(second.calls.replyWithPhoto.mock.calls[0]?.[0]).toBe('ID-1');
  });
});
