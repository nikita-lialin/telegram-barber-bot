import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROJECT_ROOT } from '../../src/paths.js';
import { detectLocale } from '../../src/i18n/index.js';

function ftlKeys(locale: string): string[] {
  const text = readFileSync(join(PROJECT_ROOT, 'locales', `${locale}.ftl`), 'utf8');
  return [...text.matchAll(/^([a-z][a-z0-9-]*)\s*=/gm)].map((m) => m[1]!);
}

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (path.endsWith('.ts')) yield path;
  }
}

describe('i18n', () => {
  it('наборы ключей в ru.ftl и en.ftl совпадают', () => {
    expect([...ftlKeys('ru')].sort()).toEqual([...ftlKeys('en')].sort());
  });

  it('в файлах нет повторяющихся ключей', () => {
    for (const locale of ['ru', 'en']) {
      const keys = ftlKeys(locale);
      expect(new Set(keys).size, locale).toBe(keys.length);
    }
  });

  it('каждый ключ, вызванный в коде через t(), есть в обоих файлах', () => {
    const used = new Set<string>();
    for (const file of sourceFiles(join(PROJECT_ROOT, 'src'))) {
      for (const m of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-z][a-z0-9-]*)'/g)) {
        used.add(m[1]!);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    const ru = new Set(ftlKeys('ru'));
    const en = new Set(ftlKeys('en'));
    for (const key of used) {
      expect(ru.has(key), `ru: ${key}`).toBe(true);
      expect(en.has(key), `en: ${key}`).toBe(true);
    }
  });

  it('язык по умолчанию: ru* даёт русский, остальное английский', () => {
    expect(detectLocale('ru')).toBe('ru');
    expect(detectLocale('ru-RU')).toBe('ru');
    expect(detectLocale('en')).toBe('en');
    expect(detectLocale('uk')).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
  });
});
