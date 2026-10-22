import { FileAdapter } from '@grammyjs/storage-file';
import { Bot, session, type StorageAdapter } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import type { Logger } from 'pino';
import type { BotContext, SessionData } from './context.js';
import type { CatalogRepository } from './data/repository.js';
import { fallbackFeature } from './features/fallback/index.js';
import { helpFeature } from './features/help/index.js';
import { languageFeature } from './features/language/index.js';
import { createMastersFeature } from './features/masters/index.js';
import { menuFeature, stubsFeature } from './features/menu/index.js';
import { createServicesFeature } from './features/services/index.js';
import { createStartFeature } from './features/start/index.js';
import { createI18n, detectLocale } from './i18n/index.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/logger.js';
import { privateOnly } from './middleware/private-only.js';

export interface BotDeps {
  token: string;
  catalog: CatalogRepository;
  logger: Logger;
  /** Папка с файлами переводов (*.ftl). */
  localesDir: string;
  /** Хранилище сессий; в тестах подставляется память. */
  sessionStorage: StorageAdapter<SessionData>;
  /** Данные бота: если заданы, getMe при старте не вызывается (нужно в тестах без сети). */
  botInfo?: UserFromGetMe;
}

export function createFileSessionStorage(dir: string): StorageAdapter<SessionData> {
  return new FileAdapter<SessionData>({ dirName: dir });
}

/** Собирает бота: порядок middleware фиксирован, модули разделов подключаются списком. */
export function createBot(deps: BotDeps): Bot<BotContext> {
  const bot = new Bot<BotContext>(deps.token, deps.botInfo ? { botInfo: deps.botInfo } : {});

  bot.use(requestLogger(deps.logger));
  bot.use(privateOnly);
  bot.use(
    session({
      initial: (): SessionData => ({}),
      storage: deps.sessionStorage,
      getSessionKey: (ctx) => ctx.from?.id.toString(),
    }),
  );
  // Язык записывается в сессию при первом же апдейте, поэтому он переживает перезапуск.
  bot.use(async (ctx, next) => {
    ctx.session.locale ??= detectLocale(ctx.from?.language_code);
    await next();
  });
  bot.use(createI18n(deps.localesDir));

  bot.use(createStartFeature(deps.catalog));
  bot.use(menuFeature);
  bot.use(createServicesFeature(deps.catalog));
  bot.use(createMastersFeature(deps.catalog));
  bot.use(languageFeature);
  bot.use(helpFeature);
  bot.use(stubsFeature);
  bot.use(fallbackFeature);

  bot.catch(createErrorHandler(deps.logger));
  return bot;
}
