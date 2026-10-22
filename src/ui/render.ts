import { GrammyError, type InlineKeyboard } from 'grammy';
import type { BotContext } from '../context.js';

export interface Screen {
  text: string;
  keyboard: InlineKeyboard;
}

export function isNotModified(err: unknown): boolean {
  return err instanceof GrammyError && err.description.includes('message is not modified');
}

export function isCannotEdit(err: unknown): boolean {
  return (
    err instanceof GrammyError &&
    (err.description.includes('message to edit not found') ||
      err.description.includes("message can't be edited"))
  );
}

/**
 * Показывает экран: по нажатию кнопки редактирует сообщение, по команде отправляет новое.
 * Повторное нажатие той же кнопки (`message is not modified`) молча игнорируется.
 */
export async function renderScreen(ctx: BotContext, screen: Screen): Promise<void> {
  const options = { reply_markup: screen.keyboard };
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(screen.text, options);
      return;
    } catch (err) {
      if (isNotModified(err)) return;
      if (!isCannotEdit(err)) throw err;
    }
  }
  await ctx.reply(screen.text, options);
}
