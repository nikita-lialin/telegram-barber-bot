import { ID_PATTERN, LOCALES, SERVICE_GROUP_IDS } from '../data/schemas.js';
import type { Locale, ServiceGroupId } from '../domain/types.js';

/** Telegram ограничивает callback_data 64 байтами. */
export const MAX_CALLBACK_BYTES = 64;

/** Мастер «Любой» в маршрутах записи. */
export const ANY_MASTER = 'any';

export type Route =
  | { kind: 'menu' }
  | { kind: 'services' }
  | { kind: 'servicesGroup'; group: ServiceGroupId }
  | { kind: 'masters' }
  | { kind: 'mastersFilter'; group: ServiceGroupId }
  | { kind: 'masterCard'; masterId: string }
  | { kind: 'masterCall'; masterId: string }
  | { kind: 'gallery' }
  | { kind: 'galleryPhoto'; category: ServiceGroupId; index: number }
  | { kind: 'schedule' }
  | { kind: 'location' }
  | { kind: 'booking' }
  | { kind: 'bookingService'; serviceId: string }
  | { kind: 'bookingMaster'; masterId: string; serviceId?: string }
  | { kind: 'bookingNoReply'; masterId: string }
  | { kind: 'bookingCall' }
  | { kind: 'language'; locale: Locale }
  | { kind: 'noop' };

export function encode(route: Route): string {
  const data = encodeParts(route);
  if (Buffer.byteLength(data) > MAX_CALLBACK_BYTES) {
    throw new Error(`callback_data длиннее ${MAX_CALLBACK_BYTES} байт: ${data}`);
  }
  return data;
}

function encodeParts(route: Route): string {
  switch (route.kind) {
    case 'menu':
      return 'm';
    case 'services':
      return 's';
    case 'servicesGroup':
      return `s:g:${route.group}`;
    case 'masters':
      return 'ms';
    case 'mastersFilter':
      return `ms:f:${route.group}`;
    case 'masterCard':
      return `ms:c:${route.masterId}`;
    case 'masterCall':
      return `ms:call:${route.masterId}`;
    case 'gallery':
      return 'g';
    case 'galleryPhoto':
      return `g:p:${route.category}:${route.index}`;
    case 'schedule':
      return 'sch';
    case 'location':
      return 'loc';
    case 'booking':
      return 'b';
    case 'bookingService':
      return `b:s:${route.serviceId}`;
    case 'bookingMaster':
      return route.serviceId === undefined
        ? `b:m:${route.masterId}`
        : `b:m:${route.masterId}:${route.serviceId}`;
    case 'bookingNoReply':
      return `b:nr:${route.masterId}`;
    case 'bookingCall':
      return 'b:call';
    case 'language':
      return `l:${route.locale}`;
    case 'noop':
      return 'noop';
  }
}

const isId = (s: string | undefined): s is string => s !== undefined && ID_PATTERN.test(s);
const isGroup = (s: string | undefined): s is ServiceGroupId =>
  SERVICE_GROUP_IDS.some((g) => g === s);
const isLocale = (s: string | undefined): s is Locale => LOCALES.some((l) => l === s);

/** Разбирает callback_data; для неизвестной или повреждённой строки возвращает undefined. */
export function decode(data: string): Route | undefined {
  if (Buffer.byteLength(data) > MAX_CALLBACK_BYTES) return undefined;
  const [head, a, b, c, ...rest] = data.split(':');
  if (rest.length > 0) return undefined;
  const count = data.split(':').length;

  switch (head) {
    case 'm':
      return count === 1 ? { kind: 'menu' } : undefined;
    case 'noop':
      return count === 1 ? { kind: 'noop' } : undefined;
    case 'sch':
      return count === 1 ? { kind: 'schedule' } : undefined;
    case 'loc':
      return count === 1 ? { kind: 'location' } : undefined;
    case 's':
      if (count === 1) return { kind: 'services' };
      if (count === 3 && a === 'g' && isGroup(b)) return { kind: 'servicesGroup', group: b };
      return undefined;
    case 'ms':
      if (count === 1) return { kind: 'masters' };
      if (count !== 3 || b === undefined) return undefined;
      if (a === 'f' && isGroup(b)) return { kind: 'mastersFilter', group: b };
      if (a === 'c' && isId(b)) return { kind: 'masterCard', masterId: b };
      if (a === 'call' && isId(b)) return { kind: 'masterCall', masterId: b };
      return undefined;
    case 'g':
      if (count === 1) return { kind: 'gallery' };
      if (count === 4 && a === 'p' && isGroup(b) && c !== undefined && /^\d{1,3}$/.test(c)) {
        return { kind: 'galleryPhoto', category: b, index: Number(c) };
      }
      return undefined;
    case 'b':
      if (count === 1) return { kind: 'booking' };
      if (count === 3 && a === 's' && isId(b)) return { kind: 'bookingService', serviceId: b };
      if (count === 3 && a === 'm' && isId(b)) return { kind: 'bookingMaster', masterId: b };
      if (count === 4 && a === 'm' && isId(b) && isId(c)) {
        return { kind: 'bookingMaster', masterId: b, serviceId: c };
      }
      if (count === 2 && a === 'call') return { kind: 'bookingCall' };
      if (count === 3 && a === 'nr' && isId(b)) return { kind: 'bookingNoReply', masterId: b };
      return undefined;
    case 'l':
      return count === 2 && isLocale(a) ? { kind: 'language', locale: a } : undefined;
    default:
      return undefined;
  }
}
