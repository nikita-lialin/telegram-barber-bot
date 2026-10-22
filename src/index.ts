import { autoRetry } from '@grammyjs/auto-retry';
import { pino } from 'pino';
import { createBot, createFileSessionStorage } from './bot.js';
import { registerCommands } from './commands.js';
import { EnvError, loadEnv } from './config/env.js';
import { CatalogError, loadCatalog } from './data/loader.js';
import { JsonCatalogRepository } from './data/repository.js';
import { PROJECT_ROOT } from './paths.js';
import { join } from 'node:path';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = pino({ level: env.LOG_LEVEL });
  const catalog = new JsonCatalogRepository(loadCatalog(PROJECT_ROOT));
  const localesDir = join(PROJECT_ROOT, 'locales');

  const bot = createBot({
    token: env.BOT_TOKEN,
    catalog,
    logger,
    localesDir,
    sessionStorage: createFileSessionStorage(env.SESSION_DIR),
  });
  bot.api.config.use(autoRetry());

  await bot.init();
  await registerCommands(bot.api, localesDir);

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'stopping');
    void bot.stop();
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  // Long polling; промис завершается после bot.stop().
  await bot.start({ onStart: (me) => logger.info({ username: me.username }, 'bot started') });
  logger.info('bot stopped');
}

main().catch((err: unknown) => {
  if (err instanceof EnvError || err instanceof CatalogError) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
});
