import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { ZodType } from 'zod';
import { ANY_MASTER } from '../ui/callback.js';
import type {
  Business,
  GalleryCategory,
  GalleryItem,
  Master,
  Schedule,
  Service,
  ServiceGroup,
} from '../domain/types.js';
import {
  businessSchema,
  galleryFileSchema,
  mastersFileSchema,
  scheduleSchema,
  servicesFileSchema,
} from './schemas.js';

export interface CatalogData {
  masters: Master[];
  groups: ServiceGroup[];
  services: Service[];
  galleryCategories: GalleryCategory[];
  galleryItems: GalleryItem[];
  schedule: Schedule;
  business: Business;
}

export class CatalogError extends Error {
  constructor(readonly problems: string[]) {
    super(`Ошибки в данных (${problems.length}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'CatalogError';
  }
}

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function hasMagic(buf: Buffer, magic: number[]): boolean {
  return magic.every((byte, i) => buf[i] === byte);
}

function readJson<T>(
  root: string,
  file: string,
  schema: ZodType<T>,
  problems: string[],
): T | undefined {
  const path = join(root, 'data', file);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    problems.push(`data/${file}: не удалось прочитать JSON (${(e as Error).message})`);
    return undefined;
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  for (const issue of parsed.error.issues) {
    problems.push(`data/${file}: ${issue.path.join('.') || '(корень)'}: ${issue.message}`);
  }
  return undefined;
}

function findDuplicates(ids: string[]): string[] {
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}

function checkPhoto(root: string, where: string, file: string, problems: string[]): void {
  const assetsDir = resolve(root, 'assets');
  const abs = resolve(assetsDir, file);
  const rel = relative(assetsDir, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    problems.push(`${where}: путь «${file}» выходит за пределы assets/`);
    return;
  }
  let size: number;
  try {
    size = statSync(abs).size;
  } catch {
    problems.push(`${where}: файл assets/${file} не найден`);
    return;
  }
  if (size > MAX_PHOTO_BYTES) {
    problems.push(`${where}: assets/${file} больше 5 МБ`);
    return;
  }
  const head = readFileSync(abs).subarray(0, 8);
  if (!hasMagic(head, PNG_MAGIC) && !hasMagic(head, JPEG_MAGIC)) {
    problems.push(`${where}: assets/${file} не JPEG и не PNG`);
  }
}

/**
 * Читает data/*.json, проверяет схемы, ссылки между файлами и фото.
 * Собирает все найденные проблемы и бросает один CatalogError.
 */
export function loadCatalog(root: string): CatalogData {
  const problems: string[] = [];

  const mastersFile = readJson(root, 'masters.json', mastersFileSchema, problems);
  const servicesFile = readJson(root, 'services.json', servicesFileSchema, problems);
  const galleryFile = readJson(root, 'gallery.json', galleryFileSchema, problems);
  const schedule = readJson(root, 'schedule.json', scheduleSchema, problems);
  const business = readJson(root, 'business.json', businessSchema, problems);

  if (!mastersFile || !servicesFile || !galleryFile || !schedule || !business) {
    throw new CatalogError(problems);
  }

  const { masters } = mastersFile;
  const { groups, services } = servicesFile;
  const { categories, items } = galleryFile;

  for (const id of findDuplicates(masters.map((m) => m.id))) {
    problems.push(`data/masters.json: повторяется id мастера «${id}»`);
  }
  if (masters.some((m) => m.id === ANY_MASTER)) {
    problems.push(`data/masters.json: id «${ANY_MASTER}» зарезервирован для выбора «Любой мастер»`);
  }
  for (const id of findDuplicates(groups.map((g) => g.id))) {
    problems.push(`data/services.json: повторяется id группы «${id}»`);
  }
  for (const id of findDuplicates(services.map((s) => s.id))) {
    problems.push(`data/services.json: повторяется id услуги «${id}»`);
  }
  for (const id of findDuplicates(categories.map((c) => c.id))) {
    problems.push(`data/gallery.json: повторяется категория «${id}»`);
  }
  for (const id of findDuplicates(items.map((i) => i.id))) {
    problems.push(`data/gallery.json: повторяется id фото «${id}»`);
  }

  const masterIds = new Set(masters.map((m) => m.id));
  const groupIds = new Set(groups.map((g) => g.id));
  const categoryIds = new Set(categories.map((c) => c.id));

  for (const s of services) {
    if (!groupIds.has(s.group)) {
      problems.push(
        `data/services.json: услуга «${s.id}» ссылается на группу «${s.group}», её нет`,
      );
    }
    for (const mid of s.masterIds) {
      if (!masterIds.has(mid)) {
        problems.push(
          `data/services.json: услуга «${s.id}» ссылается на мастера «${mid}», его нет`,
        );
      }
    }
  }
  for (const c of categories) {
    if (!groupIds.has(c.id)) {
      problems.push(`data/gallery.json: категория «${c.id}» не совпадает ни с одной группой услуг`);
    }
  }
  for (const item of items) {
    if (!categoryIds.has(item.category)) {
      problems.push(
        `data/gallery.json: фото «${item.id}» ссылается на категорию «${item.category}», её нет`,
      );
    }
    if (item.masterId !== undefined && !masterIds.has(item.masterId)) {
      problems.push(
        `data/gallery.json: фото «${item.id}» ссылается на мастера «${item.masterId}», его нет`,
      );
    }
  }

  const busyMasters = new Set(services.flatMap((s) => s.masterIds));
  for (const m of masters) {
    if (!busyMasters.has(m.id)) {
      problems.push(`data/masters.json: мастер «${m.id}» не выполняет ни одной услуги`);
    }
  }

  for (const m of masters) {
    checkPhoto(root, `data/masters.json (мастер «${m.id}»)`, m.photo, problems);
  }
  for (const item of items) {
    checkPhoto(root, `data/gallery.json (фото «${item.id}»)`, item.file, problems);
  }
  checkPhoto(root, 'data/business.json (entrancePhoto)', business.entrancePhoto, problems);

  if (problems.length > 0) throw new CatalogError(problems);

  return {
    masters,
    groups,
    services,
    galleryCategories: categories,
    galleryItems: items,
    schedule,
    business,
  };
}
