import type { Middleware } from 'grammy';
import type { BotContext } from '../context.js';

/** Пропускает только личные чаты: группы, каналы и апдейты без чата дальше не идут. */
export const privateOnly: Middleware<BotContext> = async (ctx, next) => {
  if (ctx.chat?.type === 'private') await next();
};
