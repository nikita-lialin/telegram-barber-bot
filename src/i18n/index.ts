import { I18n } from '@grammyjs/i18n';
import type { BotContext } from '../context.js';
import type { Locale, LocalizedText } from '../domain/types.js';

export const DEFAULT_LOCALE: Locale = 'en';

/** `ru*` даёт русский, всё остальное английский. */
export function detectLocale(languageCode: string | undefined): Locale {
  return languageCode !== undefined && /^ru/i.test(languageCode) ? 'ru' : 'en';
}

/** Выбирает строку нужного языка из контента data/*.json. */
export function pick(text: LocalizedText, locale: Locale): string {
  return text[locale];
}

export function createI18n(localesDir: string): I18n<BotContext> {
  const i18n = new I18n<BotContext>({
    defaultLocale: DEFAULT_LOCALE,
    directory: localesDir,
    fluentBundleOptions: { useIsolating: false },
    localeNegotiator: (ctx) => ctx.session.locale ?? detectLocale(ctx.from?.language_code),
  });
  return i18n;
}

/** Текущий язык пользователя; к этому моменту его уже записал middleware сессии. */
export function currentLocale(ctx: BotContext): Locale {
  return ctx.session.locale ?? detectLocale(ctx.from?.language_code);
}
