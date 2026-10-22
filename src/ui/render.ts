import { resolve } from 'node:path';
import { GrammyError, InputFile, type InlineKeyboard } from 'grammy';
import type { Message } from 'grammy/types';
import type { BotContext } from '../context.js';
import { PROJECT_ROOT } from '../paths.js';

export interface Screen {
  text: string;
  keyboard: InlineKeyboard;
  /** Путь к фото внутри assets/ (например `masters/olga.png`); текст тогда уходит подписью. */
  photo?: string;
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
 * file_id уже загруженных фото: повторная отправка идёт по id без загрузки файла.
 * Живёт в памяти, после перезапуска первая отправка снова загрузит файл.
 */
const fileIds = new Map<string, string>();

export function clearPhotoCache(): void {
  fileIds.clear();
}

function photoInput(photo: string): string | InputFile {
  return fileIds.get(photo) ?? new InputFile(resolve(PROJECT_ROOT, 'assets', photo));
}

function rememberPhoto(photo: string, result: Message | true): void {
  if (result === true) return;
  const largest = result.photo?.at(-1);
  if (largest) fileIds.set(photo, largest.file_id);
}

async function sendNew(ctx: BotContext, screen: Screen): Promise<void> {
  const options = { reply_markup: screen.keyboard };
  if (screen.photo === undefined) {
    await ctx.reply(screen.text, options);
    return;
  }
  const sent = await ctx.replyWithPhoto(photoInput(screen.photo), {
    ...options,
    caption: screen.text,
  });
  rememberPhoto(screen.photo, sent);
}

/**
 * Показывает экран: по нажатию кнопки редактирует сообщение, по команде отправляет новое.
 *
 * | было → стало  | действие                                              |
 * |---------------|-------------------------------------------------------|
 * | текст → текст | editMessageText                                       |
 * | фото → фото   | editMessageMedia                                      |
 * | текст ↔ фото  | новое сообщение, старое удаляется после успешной отправки |
 *
 * Повторное нажатие той же кнопки (`message is not modified`) молча игнорируется.
 */
export async function renderScreen(ctx: BotContext, screen: Screen): Promise<void> {
  const current = ctx.callbackQuery?.message;
  if (!current) {
    await sendNew(ctx, screen);
    return;
  }

  const wasPhoto = 'photo' in current && current.photo !== undefined;
  const willBePhoto = screen.photo !== undefined;

  if (wasPhoto === willBePhoto) {
    try {
      if (screen.photo === undefined) {
        await ctx.editMessageText(screen.text, { reply_markup: screen.keyboard });
      } else {
        const edited = await ctx.editMessageMedia(
          { type: 'photo', media: photoInput(screen.photo), caption: screen.text },
          { reply_markup: screen.keyboard },
        );
        rememberPhoto(screen.photo, edited);
      }
      return;
    } catch (err) {
      if (isNotModified(err)) return;
      if (!isCannotEdit(err)) throw err;
    }
    await sendNew(ctx, screen);
    return;
  }

  await sendNew(ctx, screen);
  try {
    await ctx.api.deleteMessage(current.chat.id, current.message_id);
  } catch {
    // Старше 48 часов или уже удалено: экран показан, лишнее сообщение не критично.
  }
}
