import type { Api } from 'grammy';
import { I18n } from '@grammyjs/i18n';
import { DEFAULT_LOCALE } from './i18n/index.js';

const COMMANDS = ['start', 'menu', 'help'] as const;

/** Регистрирует список команд для каждого языка, чтобы описания в меню Telegram тоже переводились. */
export async function registerCommands(api: Api, localesDir: string): Promise<void> {
  const i18n = new I18n({
    defaultLocale: DEFAULT_LOCALE,
    directory: localesDir,
    fluentBundleOptions: { useIsolating: false },
  });
  for (const locale of i18n.locales) {
    const commands = COMMANDS.map((command) => ({
      command,
      description: i18n.t(locale, `cmd-${command}-description`),
    }));
    await api.setMyCommands(commands, { language_code: locale as 'ru' | 'en' });
  }
  await api.setMyCommands(
    COMMANDS.map((command) => ({
      command,
      description: i18n.t(DEFAULT_LOCALE, `cmd-${command}-description`),
    })),
  );
}
