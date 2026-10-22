import type { I18nFlavor } from '@grammyjs/i18n';
import type { Context, SessionFlavor } from 'grammy';
import type { Locale } from './domain/types.js';

export interface SessionData {
  locale?: Locale;
}

export type BotContext = Context & SessionFlavor<SessionData> & I18nFlavor;
