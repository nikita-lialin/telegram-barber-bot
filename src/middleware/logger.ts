import type { Logger } from 'pino';
import type { Middleware } from 'grammy';
import type { BotContext } from '../context.js';

/** Логирует тип апдейта и его id, без текста сообщений и персональных данных. */
export function requestLogger(logger: Logger): Middleware<BotContext> {
  return async (ctx, next) => {
    const started = Date.now();
    await next();
    logger.debug({ updateId: ctx.update.update_id, ms: Date.now() - started }, 'update handled');
  };
}
