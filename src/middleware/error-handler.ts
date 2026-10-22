import { GrammyError, HttpError, type BotError } from 'grammy';
import type { Logger } from 'pino';
import type { BotContext } from '../context.js';
import { mainMenuKeyboard } from '../ui/keyboards.js';
import { isCannotEdit, isNotModified } from '../ui/render.js';

/** Обработчик для `bot.catch`: классифицирует ошибку, логирует и не даёт боту упасть. */
export function createErrorHandler(logger: Logger) {
  return async (err: BotError<BotContext>): Promise<void> => {
    const { ctx } = err;
    const cause: unknown = err.error;
    const updateId = ctx.update.update_id;

    if (isNotModified(cause)) return;

    if (cause instanceof GrammyError && cause.error_code === 403) {
      logger.info({ updateId }, 'user blocked the bot');
      return;
    }

    if (cause instanceof HttpError) {
      logger.warn({ updateId, err: cause }, 'network error');
      return;
    }

    if (isCannotEdit(cause)) {
      logger.warn({ updateId }, 'message cannot be edited');
    } else {
      logger.error({ updateId, err: cause }, 'unhandled error');
    }

    try {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => undefined);
      if (ctx.chat) {
        await ctx.reply(ctx.t('errors-generic'), { reply_markup: mainMenuKeyboard(ctx) });
      }
    } catch (replyErr) {
      logger.warn({ updateId, err: replyErr }, 'failed to send error screen');
    }
  };
}
