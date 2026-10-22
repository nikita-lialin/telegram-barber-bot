import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv } from '../../src/config/env.js';

const TOKEN = '123456:ABCdefGhIJKlmNoPQRsTUVwxyZ_0123456789';

describe('loadEnv', () => {
  it('подставляет значения по умолчанию', () => {
    expect(loadEnv({ BOT_TOKEN: TOKEN })).toEqual({
      BOT_TOKEN: TOKEN,
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      SESSION_DIR: './sessions',
    });
  });

  it('падает с понятной ошибкой без токена и с неверным токеном', () => {
    expect(() => loadEnv({})).toThrow(EnvError);
    expect(() => loadEnv({})).toThrow(/BOT_TOKEN/);
    expect(() => loadEnv({ BOT_TOKEN: 'abc' })).toThrow(/@BotFather/);
  });

  it('отвергает неизвестный уровень логов', () => {
    expect(() => loadEnv({ BOT_TOKEN: TOKEN, LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });
});
