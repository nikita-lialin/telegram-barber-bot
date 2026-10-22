import { z } from 'zod';

export const LOCALES = ['ru', 'en'] as const;
export const SERVICE_GROUP_IDS = ['men', 'women', 'kids', 'coloring'] as const;
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Ограничение длины держит callback_data в пределах 64 байт. */
export const ID_PATTERN = /^[a-z0-9-]{1,20}$/;

export const localeSchema = z.enum(LOCALES);
export const idSchema = z.string().regex(ID_PATTERN, 'id: a-z, 0-9, дефис, до 20 символов');
export const serviceGroupIdSchema = z.enum(SERVICE_GROUP_IDS);

const filledString = z.string().trim().min(1, 'пустая строка');

export const localizedTextSchema = z.object({
  ru: filledString,
  en: filledString,
});

export const contactsSchema = z
  .object({
    whatsapp: z
      .string()
      .regex(/^\d{8,15}$/, 'E.164 без «+», например 79990000001')
      .optional(),
    phone: z
      .string()
      .regex(/^\+\d[\d\s()-]{6,18}$/, 'например +7 999 000-00-01')
      .optional(),
    telegram: z
      .string()
      .regex(/^[A-Za-z0-9_]{5,32}$/, 'username без @')
      .optional(),
    instagram: z
      .string()
      .regex(/^[A-Za-z0-9._]{1,30}$/, 'username без @')
      .optional(),
  })
  .refine((c) => Object.values(c).some((v) => v !== undefined), {
    message: 'нужен хотя бы один канал связи',
  });

export const masterSchema = z.object({
  id: idSchema,
  name: localizedTextSchema,
  photo: filledString,
  specialization: localizedTextSchema,
  contacts: contactsSchema,
  contactHours: localizedTextSchema,
});

export const mastersFileSchema = z.object({ masters: z.array(masterSchema) });

export const priceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('from'), amount: z.number().int().positive() }),
]);

export const serviceSchema = z.object({
  id: idSchema,
  group: serviceGroupIdSchema,
  title: localizedTextSchema,
  price: priceSchema,
  durationMin: z
    .object({ min: z.number().int().positive(), max: z.number().int().positive().optional() })
    .refine((d) => d.max === undefined || d.max >= d.min, {
      message: 'max не может быть меньше min',
    }),
  note: localizedTextSchema.optional(),
  masterIds: z.array(idSchema).min(1, 'нужен хотя бы один мастер'),
});

export const serviceGroupSchema = z.object({
  id: serviceGroupIdSchema,
  title: localizedTextSchema,
  emoji: filledString,
  order: z.number().int(),
});

export const servicesFileSchema = z.object({
  groups: z.array(serviceGroupSchema),
  services: z.array(serviceSchema),
});

export const galleryCategorySchema = z.object({
  id: serviceGroupIdSchema,
  title: localizedTextSchema,
  order: z.number().int(),
});

export const galleryItemSchema = z.object({
  id: idSchema,
  category: serviceGroupIdSchema,
  file: filledString,
  caption: localizedTextSchema,
  masterId: idSchema.optional(),
});

export const galleryFileSchema = z.object({
  categories: z.array(galleryCategorySchema),
  items: z.array(galleryItemSchema),
});

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'время в формате HH:MM');

export const timeRangeSchema = z
  .object({ open: timeSchema, close: timeSchema })
  .refine((r) => r.open < r.close, { message: 'open должен быть раньше close' });

const timezoneSchema = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'неизвестный часовой пояс IANA' },
);

export const scheduleSchema = z.object({
  timezone: timezoneSchema,
  weekly: z.object(
    Object.fromEntries(WEEKDAYS.map((d) => [d, timeRangeSchema.nullable()])) as Record<
      (typeof WEEKDAYS)[number],
      z.ZodNullable<typeof timeRangeSchema>
    >,
  ),
  exceptions: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'дата в формате YYYY-MM-DD'),
      hours: timeRangeSchema.nullable(),
      note: localizedTextSchema.optional(),
    }),
  ),
  specialDaysNote: localizedTextSchema,
});

export const businessSchema = z.object({
  name: localizedTextSchema,
  address: localizedTextSchema,
  mapLinks: z
    .object({ yandex: z.url().optional(), google: z.url().optional() })
    .refine((m) => m.yandex !== undefined || m.google !== undefined, {
      message: 'нужна хотя бы одна ссылка на карту',
    }),
  geo: z
    .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
    .optional(),
  entranceHint: localizedTextSchema,
  entrancePhoto: filledString,
  contacts: contactsSchema,
  currency: z.literal('RUB'),
});
