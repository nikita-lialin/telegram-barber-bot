/** Минимальный интервал между подсказками одному пользователю. */
export const HINT_INTERVAL_MS = 30_000;

/** При таком размере карты перед записью удаляются просроченные записи. */
const SWEEP_THRESHOLD = 1_000;

export interface HintLimiter {
  /** true, если подсказку можно отправить сейчас; в этом случае время запоминается. */
  tryAcquire(userId: number, nowMs: number): boolean;
}

/**
 * Ограничение частоты подсказок. Таймстемпы лежат в памяти процесса (Map): после
 * перезапуска бот при необходимости один раз лишний раз ответит, а база ради этого не нужна.
 * Время приходит параметром, поэтому логика детерминирована.
 */
export function createHintLimiter(intervalMs: number = HINT_INTERVAL_MS): HintLimiter {
  const lastHintAt = new Map<number, number>();

  return {
    tryAcquire(userId, nowMs) {
      const last = lastHintAt.get(userId);
      if (last !== undefined && nowMs - last < intervalMs) return false;

      if (lastHintAt.size >= SWEEP_THRESHOLD) {
        for (const [id, at] of lastHintAt) {
          if (nowMs - at >= intervalMs) lastHintAt.delete(id);
        }
      }
      lastHintAt.set(userId, nowMs);
      return true;
    },
  };
}
