import { describe, expect, it } from 'vitest';
import { decode, encode, MAX_CALLBACK_BYTES, type Route } from '../../src/ui/callback.js';

const ROUTES: Array<[Route, string]> = [
  [{ kind: 'menu' }, 'm'],
  [{ kind: 'services' }, 's'],
  [{ kind: 'servicesGroup', group: 'men' }, 's:g:men'],
  [{ kind: 'masters' }, 'ms'],
  [{ kind: 'mastersFilter', group: 'coloring' }, 'ms:f:coloring'],
  [{ kind: 'masterCard', masterId: 'olga' }, 'ms:c:olga'],
  [{ kind: 'masterCall', masterId: 'olga' }, 'ms:call:olga'],
  [{ kind: 'gallery' }, 'g'],
  [{ kind: 'galleryPhoto', category: 'women', index: 3 }, 'g:p:women:3'],
  [{ kind: 'schedule' }, 'sch'],
  [{ kind: 'location' }, 'loc'],
  [{ kind: 'booking' }, 'b'],
  [{ kind: 'bookingService', serviceId: 'coloring-full' }, 'b:s:coloring-full'],
  [{ kind: 'bookingMaster', masterId: 'any' }, 'b:m:any'],
  [{ kind: 'bookingCall' }, 'b:call'],
  [
    { kind: 'bookingMaster', masterId: 'olga', serviceId: 'coloring-full' },
    'b:m:olga:coloring-full',
  ],
  [{ kind: 'bookingNoReply', masterId: 'olga' }, 'b:nr:olga'],
  [{ kind: 'language', locale: 'ru' }, 'l:ru'],
  [{ kind: 'language', locale: 'en' }, 'l:en'],
  [{ kind: 'noop' }, 'noop'],
];

describe('callback_data', () => {
  it.each(ROUTES)('encode и decode взаимно обратны: %j', (route, data) => {
    expect(encode(route)).toBe(data);
    expect(decode(data)).toEqual(route);
  });

  it.each([
    '',
    'x',
    'm:1',
    's:g',
    's:g:unknown',
    'ms:c:Bad_Id',
    'g:p:men:abc',
    'l:de',
    'b:m:a:b:c',
  ])('decode отвергает неизвестное «%s»', (data) => {
    expect(decode(data)).toBeUndefined();
  });

  it('самый длинный маршрут укладывается в 64 байта, длиннее отвергается', () => {
    const id = 'a'.repeat(20);
    const longest = encode({ kind: 'bookingMaster', masterId: id, serviceId: id });
    expect(Buffer.byteLength(longest)).toBe(45);
    expect(Buffer.byteLength(longest)).toBeLessThanOrEqual(MAX_CALLBACK_BYTES);
    expect(decode(`b:m:${'a'.repeat(40)}`)).toBeUndefined();
    expect(() => encode({ kind: 'masterCard', masterId: 'я'.repeat(40) })).toThrow();
  });
});
