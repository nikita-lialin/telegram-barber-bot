import { join } from 'node:path';
import { MemorySessionStorage } from 'grammy';
import type { InlineKeyboardMarkup, Update, UserFromGetMe } from 'grammy/types';
import { pino } from 'pino';
import { createBot } from '../../src/bot.js';
import type { SessionData } from '../../src/context.js';
import { loadCatalog } from '../../src/data/loader.js';
import { JsonCatalogRepository } from '../../src/data/repository.js';
import { PROJECT_ROOT } from '../../src/paths.js';

export interface ApiCall {
  method: string;
  payload: Record<string, unknown>;
}

const botInfo = {
  id: 42,
  is_bot: true,
  first_name: 'Barber',
  username: 'barber_test_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
} as unknown as UserFromGetMe;

let updateCounter = 0;

/** Бот на реальных data/*.json; запросы к Telegram перехватываются, сеть не нужна. */
/** `now` фиксирует время для разделов с часами и для антиспама; `setNow` двигает его в тесте. Без `now` берутся реальные часы. */
export function createTestBot(options: { now?: Date } = {}) {
  let currentNow = options.now;
  const calls: ApiCall[] = [];
  const sessions = new MemorySessionStorage<SessionData>();
  const bot = createBot({
    token: '123456:TEST-TOKEN-0123456789abcdef',
    catalog: new JsonCatalogRepository(loadCatalog(PROJECT_ROOT)),
    logger: pino({ level: 'silent' }),
    localesDir: join(PROJECT_ROOT, 'locales'),
    sessionStorage: sessions,
    botInfo,
    now: () => currentNow ?? new Date(),
  });

  bot.api.config.use((_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    const message = { message_id: 100, date: 0, chat: { id: 1, type: 'private' } };
    const photoMessage = { ...message, photo: [{ file_id: 'FILE-ID', width: 1, height: 1 }] };
    const result =
      method === 'sendMessage'
        ? message
        : method === 'sendPhoto' || method === 'editMessageMedia'
          ? photoMessage
          : true;
    return Promise.resolve({ ok: true, result } as never);
  });

  const from = (languageCode: string | undefined, userId = 1) => ({
    id: userId,
    is_bot: false,
    first_name: 'Tester',
    ...(languageCode ? { language_code: languageCode } : {}),
  });

  return {
    bot,
    calls,
    sessions,
    setNow(date: Date) {
      currentNow = date;
    },
    /** Не-командное сообщение: `content` задаёт тип (текст, стикер, фото и т.д.). */
    async sendMessage(content: MessageContent, options: SendOptions = {}) {
      const userId = options.userId ?? 1;
      await bot.handleUpdate({
        update_id: ++updateCounter,
        message: {
          message_id: updateCounter,
          date: 0,
          chat: { id: userId, type: options.chatType ?? 'private' },
          from: from(options.languageCode, userId),
          ...content,
        },
      } as Update);
    },
    async sendCommand(command: string, languageCode?: string, chatType = 'private') {
      const text = `/${command}`;
      await bot.handleUpdate({
        update_id: ++updateCounter,
        message: {
          message_id: updateCounter,
          date: 0,
          chat: { id: 1, type: chatType },
          from: from(languageCode),
          text,
          entities: [{ type: 'bot_command', offset: 0, length: text.length }],
        },
      } as Update);
    },
    /** `fromPhoto` имитирует нажатие кнопки под сообщением с фото. */
    async sendCallback(data: string, languageCode?: string, fromPhoto = false) {
      await bot.handleUpdate({
        update_id: ++updateCounter,
        callback_query: {
          id: String(updateCounter),
          from: from(languageCode),
          chat_instance: 'x',
          data,
          message: {
            message_id: 100,
            date: 0,
            chat: { id: 1, type: 'private' },
            ...(fromPhoto ? { photo: [{ file_id: 'OLD', width: 1, height: 1 }] } : { text: 'old' }),
          },
        },
      } as Update);
    },
  };
}

export type MessageContent = Record<string, unknown>;

export interface SendOptions {
  userId?: number;
  languageCode?: string;
  chatType?: string;
}

/** Готовые тела не-командных сообщений для `sendMessage`. */
export const messages = {
  text: (text: string): MessageContent => ({ text }),
  sticker: (): MessageContent => ({
    sticker: { file_id: 'S', file_unique_id: 'S', type: 'regular', width: 1, height: 1 },
  }),
  photo: (): MessageContent => ({
    photo: [{ file_id: 'P', file_unique_id: 'P', width: 1, height: 1 }],
  }),
  voice: (): MessageContent => ({ voice: { file_id: 'V', file_unique_id: 'V', duration: 1 } }),
  document: (): MessageContent => ({ document: { file_id: 'D', file_unique_id: 'D' } }),
};

export function callbackData(markup: unknown): string[] {
  const keyboard = markup as InlineKeyboardMarkup;
  return keyboard.inline_keyboard
    .flat()
    .flatMap((b) => ('callback_data' in b ? [b.callback_data] : []));
}

export function buttonTexts(markup: unknown): string[] {
  return (markup as InlineKeyboardMarkup).inline_keyboard.flat().map((b) => b.text);
}
