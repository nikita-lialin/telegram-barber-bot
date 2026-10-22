import { z } from 'zod';

const envSchema = z.object({
  BOT_TOKEN: z
    .string({ error: 'не задан' })
    .regex(/^\d+:[A-Za-z0-9_-]{20,}$/, 'ожидается токен от @BotFather вида 123456:ABC...'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SESSION_DIR: z.string().min(1).default('./sessions'),
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

/** Читает и проверяет переменные окружения. Источник передаётся параметром для тестов. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return parsed.data;
  const lines = parsed.error.issues.map((i) => `  ${i.path.join('.') || '(env)'}: ${i.message}`);
  throw new EnvError(`Неверные переменные окружения:\n${lines.join('\n')}`);
}
