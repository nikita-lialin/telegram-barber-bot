import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { registerShutdown } from '../../src/shutdown.js';

function setup() {
  const bot = { stop: vi.fn(() => Promise.resolve()) };
  const logger = { info: vi.fn() };
  const proc = new EventEmitter();
  registerShutdown(bot, logger, proc);
  return { bot, logger, proc };
}

describe('registerShutdown', () => {
  it.each(['SIGTERM', 'SIGINT'] as const)('%s вызывает bot.stop() один раз', (signal) => {
    const { bot, proc } = setup();
    proc.emit(signal);
    expect(bot.stop).toHaveBeenCalledTimes(1);
  });

  it.each(['SIGTERM', 'SIGINT'] as const)('повторный %s не вызывает второй stop', (signal) => {
    const { bot, proc } = setup();
    proc.emit(signal);
    proc.emit(signal);
    expect(bot.stop).toHaveBeenCalledTimes(1);
  });

  it.each(['SIGTERM', 'SIGINT'] as const)('в лог пишется signal %s', (signal) => {
    const { logger, proc } = setup();
    proc.emit(signal);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith({ signal }, 'stopping');
  });

  it('без сигнала stop не вызывается', () => {
    const { bot } = setup();
    expect(bot.stop).not.toHaveBeenCalled();
  });
});
