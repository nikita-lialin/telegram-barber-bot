import type { z } from 'zod';
import type {
  businessSchema,
  contactsSchema,
  galleryCategorySchema,
  galleryItemSchema,
  localeSchema,
  localizedTextSchema,
  masterSchema,
  priceSchema,
  scheduleSchema,
  serviceGroupIdSchema,
  serviceGroupSchema,
  serviceSchema,
  timeRangeSchema,
} from '../data/schemas.js';

export type Locale = z.infer<typeof localeSchema>;
export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type ServiceGroupId = z.infer<typeof serviceGroupIdSchema>;
export type Id = string;
export type Contacts = z.infer<typeof contactsSchema>;
export type Master = z.infer<typeof masterSchema>;
export type Price = z.infer<typeof priceSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type ServiceGroup = z.infer<typeof serviceGroupSchema>;
export type GalleryCategory = z.infer<typeof galleryCategorySchema>;
export type GalleryItem = z.infer<typeof galleryItemSchema>;
export type TimeRange = z.infer<typeof timeRangeSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type Weekday = keyof Schedule['weekly'];
export type Business = z.infer<typeof businessSchema>;
