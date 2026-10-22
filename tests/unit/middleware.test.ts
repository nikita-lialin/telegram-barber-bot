import { BotError, GrammyError, HttpError, type MiddlewareFn } from 'grammy';
import { describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../../src/context.js';
import { createErrorHandler } from '../../src/middleware/error-handler.js';
import { privateOnly } from '../../src/middleware/private-only.js';

describe('privateOnly', () => {
  const run = async (chat: { type: string } | undefined) => {
    const next = vi.fn(() => Promise.resolve());
    await (privateOnly as MiddlewareFn<BotContext>)({ chat } as unknown as BotContext, next);
    return next;
  };

  it('пропускает личный чат', async () => {
    expect(await run({ type: 'private' })).toHaveBeenCalledOnce();
  });

  it('отсекает группы, супергруппы, каналы и апдейты без чата', async () => {
    for (const chat of [
      { type: 'group' },
      { type: 'supergroup' },
      { type: 'channel' },
      undefined,
    ]) {
      expect(await run(chat)).not.toHaveBeenCalled();
    }
  });
});

function telegramError(code: number, description: string): GrammyError {
  return new GrammyError(
    description,
    { ok: false, error_code: code, description },
    'sendMessage',
    {},
  );
}

function setup(cause: unknown, options: { callback?: boolean; replyFails?: boolean } = {}) {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const ctx = {
    update: { update_id: 7 },
    chat: { id: 1, type: 'private' },
    callbackQuery: options.callback ? { id: 'q' } : undefined,
    t: (key: string) => key,
    reply: vi.fn(() =>
      options.replyFails ? Promise.reject(new Error('fail')) : Promise.resolve(),
    ),
    answerCallbackQuery: vi.fn(() => Promise.resolve()),
  };
  const handler = createErrorHandler(logger as never);
  const run = () => handler(new BotError(cause, ctx as unknown as BotContext));
  return { ctx, logger, run };
}

describe('createErrorHandler', () => {
  it('«message is not modified» игнорируется молча', async () => {
    const { ctx, logger, run } = setup(telegramError(400, 'Bad Request: message is not modified'));
    await run();
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('403: лог info, ничего не отправляется', async () => {
    const { ctx, logger, run } = setup(
      telegramError(403, 'Forbidden: bot was blocked by the user'),
    );
    await run();
    expect(logger.info).toHaveBeenCalledOnce();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('HttpError: лог warn, ничего не отправляется', async () => {
    const { ctx, logger, run } = setup(new HttpError('network', new Error('down')));
    await run();
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("«message can't be edited»: warn и экран с меню новым сообщением", async () => {
    const { ctx, logger, run } = setup(telegramError(400, "Bad Request: message can't be edited"));
    await run();
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledOnce();
  });

  it('любая другая ошибка: лог error и сообщение errors-generic с кнопкой меню', async () => {
    const { ctx, logger, run } = setup(new Error('boom'));
    await run();
    expect(logger.error).toHaveBeenCalledOnce();
    expect(ctx.reply).toHaveBeenCalledWith(
      'errors-generic',
      expect.objectContaining({ reply_markup: expect.anything() as unknown }),
    );
  });

  it('для callback дополнительно вызывается answerCallbackQuery', async () => {
    const { ctx, run } = setup(new Error('boom'), { callback: true });
    await run();
    expect(ctx.answerCallbackQuery).toHaveBeenCalledOnce();
  });

  it('сбой при отправке экрана ошибки не пробрасывается', async () => {
    const { logger, run } = setup(new Error('boom'), { replyFails: true });
    await expect(run()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
