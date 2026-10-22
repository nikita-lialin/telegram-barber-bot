import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CatalogError, loadCatalog } from '../../src/data/loader.js';
import { JsonCatalogRepository } from '../../src/data/repository.js';
import {
  businessSchema,
  contactsSchema,
  localizedTextSchema,
  priceSchema,
  scheduleSchema,
  serviceSchema,
} from '../../src/data/schemas.js';
import { PROJECT_ROOT } from '../../src/paths.js';
import { encode, MAX_CALLBACK_BYTES } from '../../src/ui/callback.js';

const data = loadCatalog(PROJECT_ROOT);
const repo = new JsonCatalogRepository(data);

describe('схемы', () => {
  it('LocalizedText требует оба языка', () => {
    expect(localizedTextSchema.safeParse({ ru: 'а', en: 'a' }).success).toBe(true);
    expect(localizedTextSchema.safeParse({ ru: 'а' }).success).toBe(false);
    expect(localizedTextSchema.safeParse({ ru: 'а', en: '  ' }).success).toBe(false);
  });

  it('Contacts требует хотя бы один канал', () => {
    expect(contactsSchema.safeParse({}).success).toBe(false);
    expect(contactsSchema.safeParse({ whatsapp: '79990000001' }).success).toBe(true);
    expect(contactsSchema.safeParse({ whatsapp: '+7 999' }).success).toBe(false);
  });

  it('Price различает fixed и from', () => {
    expect(priceSchema.safeParse({ kind: 'fixed', amount: 1500 }).success).toBe(true);
    expect(priceSchema.safeParse({ kind: 'from', amount: 4500 }).success).toBe(true);
    expect(priceSchema.safeParse({ kind: 'free', amount: 0 }).success).toBe(false);
  });

  it('Service: id не длиннее 20 символов и max не меньше min', () => {
    const base = data.services[0]!;
    expect(serviceSchema.safeParse(base).success).toBe(true);
    expect(serviceSchema.safeParse({ ...base, id: 'a'.repeat(21) }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, durationMin: { min: 60, max: 30 } }).success).toBe(
      false,
    );
    expect(serviceSchema.safeParse({ ...base, masterIds: [] }).success).toBe(false);
  });

  it('Schedule отвергает неверное время и часовой пояс', () => {
    expect(scheduleSchema.safeParse(data.schedule).success).toBe(true);
    expect(scheduleSchema.safeParse({ ...data.schedule, timezone: 'Mars/Base' }).success).toBe(
      false,
    );
    const weekly = { ...data.schedule.weekly, mon: { open: '20:00', close: '10:00' } };
    expect(scheduleSchema.safeParse({ ...data.schedule, weekly }).success).toBe(false);
  });

  it('Business требует ссылку на карту', () => {
    expect(businessSchema.safeParse(data.business).success).toBe(true);
    expect(businessSchema.safeParse({ ...data.business, mapLinks: {} }).success).toBe(false);
  });
});

describe('черновые данные (критерии приёмки)', () => {
  it('4 мастера, 4 группы, у каждого мастера есть услуги и Instagram', () => {
    expect(data.masters).toHaveLength(4);
    expect(data.groups).toHaveLength(4);
    for (const m of data.masters) {
      expect(m.contacts.instagram, m.id).toBeTruthy();
      expect(
        data.services.some((s) => s.masterIds.includes(m.id)),
        m.id,
      ).toBe(true);
    }
  });

  it('у каждой услуги есть цена и длительность, окрашивание помечено «от»', () => {
    for (const s of data.services) {
      expect(s.price.amount, s.id).toBeGreaterThan(0);
      expect(s.durationMin.min, s.id).toBeGreaterThan(0);
    }
    expect(data.services.find((s) => s.id === 'coloring-full')?.price.kind).toBe('from');
  });

  it('не меньше 8 фото в 3+ категориях', () => {
    expect(data.galleryItems.length).toBeGreaterThanOrEqual(8);
    const categories = new Set(data.galleryItems.map((i) => i.category));
    expect(categories.size).toBeGreaterThanOrEqual(3);
  });

  it('самые длинные callback_data на реальных данных укладываются в 64 байта', () => {
    for (const m of data.masters) {
      for (const s of data.services) {
        const bytes = Buffer.byteLength(
          encode({ kind: 'bookingMaster', masterId: m.id, serviceId: s.id }),
        );
        expect(bytes).toBeLessThanOrEqual(MAX_CALLBACK_BYTES);
      }
    }
  });
});

describe('JsonCatalogRepository', () => {
  it('фильтрует мастеров по группе услуг', async () => {
    expect((await repo.getMasters()).map((m) => m.id)).toHaveLength(4);
    expect((await repo.getMasters('coloring')).map((m) => m.id)).toEqual(['olga']);
  });

  it('отдаёт группы по order и галерею только по непустым категориям', async () => {
    const groups = await repo.getServiceGroups();
    expect(groups.map((g) => g.order)).toEqual([...groups.map((g) => g.order)].sort());
    expect((await repo.getGalleryCategories()).length).toBeGreaterThanOrEqual(3);
    expect((await repo.getGallery('men')).length).toBeGreaterThan(0);
  });

  it('находит запись по id и возвращает undefined для неизвестной', async () => {
    expect((await repo.getMaster('olga'))?.id).toBe('olga');
    expect(await repo.getMaster('nobody')).toBeUndefined();
    expect((await repo.getService('men-haircut'))?.group).toBe('men');
    expect((await repo.getServices('kids')).length).toBeGreaterThan(0);
    expect((await repo.getBusiness()).currency).toBe('RUB');
    expect((await repo.getSchedule()).timezone).toBe('Europe/Moscow');
  });
});

describe('проверки загрузчика при старте', () => {
  let tmp: string | undefined;

  afterEach(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
    tmp = undefined;
  });

  function copyProject(): string {
    tmp = mkdtempSync(join(tmpdir(), 'barber-data-'));
    cpSync(join(PROJECT_ROOT, 'data'), join(tmp, 'data'), { recursive: true });
    cpSync(join(PROJECT_ROOT, 'assets'), join(tmp, 'assets'), { recursive: true });
    return tmp;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- правим произвольный JSON в тестах
  function edit(root: string, file: string, change: (json: any) => void): void {
    const path = join(root, 'data', file);
    const json = JSON.parse(readFileSync(path, 'utf8'));
    change(json);
    writeFileSync(path, JSON.stringify(json));
  }

  function problemsOf(root: string): string[] {
    try {
      loadCatalog(root);
    } catch (e) {
      expect(e).toBeInstanceOf(CatalogError);
      return (e as CatalogError).problems;
    }
    return [];
  }

  it('ловит ссылку услуги на несуществующего мастера', () => {
    const root = copyProject();
    edit(root, 'services.json', (j) => (j.services[0].masterIds = ['ghost']));
    expect(problemsOf(root).join('\n')).toContain('ссылается на мастера «ghost»');
  });

  it('ловит мастера без услуг и повторяющиеся id', () => {
    const root = copyProject();
    edit(root, 'services.json', (j) => {
      j.services = j.services.filter(
        (s: { masterIds: string[] }) => !s.masterIds.includes('denis'),
      );
    });
    edit(root, 'masters.json', (j) => (j.masters[1].id = j.masters[0].id));
    const text = problemsOf(root).join('\n');
    expect(text).toContain('не выполняет ни одной услуги');
    expect(text).toContain('повторяется id мастера');
  });

  it('ловит отсутствующий и неверный файл фото', () => {
    const root = copyProject();
    edit(root, 'masters.json', (j) => {
      j.masters[0].photo = 'masters/nope.png';
      j.masters[1].photo = '../data/masters.json';
    });
    const text = problemsOf(root).join('\n');
    expect(text).toContain('assets/masters/nope.png не найден');
    expect(text).toContain('выходит за пределы assets/');
  });

  it('ловит файл, который не JPEG и не PNG', () => {
    const root = copyProject();
    writeFileSync(join(root, 'assets', 'masters', 'alexey.png'), 'not an image');
    expect(problemsOf(root).join('\n')).toContain('не JPEG и не PNG');
  });

  it('называет файл и поле при нарушении схемы', () => {
    const root = copyProject();
    edit(root, 'schedule.json', (j) => (j.weekly.mon = { open: '25:00', close: '26:00' }));
    expect(problemsOf(root).join('\n')).toContain('data/schedule.json: weekly.mon.open');
  });
});
