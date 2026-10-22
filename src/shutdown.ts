export interface Stoppable {
  stop(): Promise<unknown>;
}

export interface ShutdownLogger {
  info(obj: object, msg: string): void;
}

export interface SignalSource {
  once(signal: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
}

/** Graceful shutdown: по SIGINT/SIGTERM останавливает long polling через bot.stop(). */
export function registerShutdown(
  bot: Stoppable,
  logger: ShutdownLogger,
  proc: SignalSource = process,
): void {
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'stopping');
    void bot.stop();
  };
  proc.once('SIGINT', () => shutdown('SIGINT'));
  proc.once('SIGTERM', () => shutdown('SIGTERM'));
}
