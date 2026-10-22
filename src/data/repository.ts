import type {
  Business,
  GalleryCategory,
  GalleryItem,
  Master,
  Schedule,
  Service,
  ServiceGroup,
  ServiceGroupId,
} from '../domain/types.js';
import type { CatalogData } from './loader.js';

export interface CatalogRepository {
  /** Без аргумента все мастера, с группой только те, кто выполняет услуги этой группы. */
  getMasters(group?: ServiceGroupId): Promise<Master[]>;
  getMaster(id: string): Promise<Master | undefined>;
  /** Отсортированы по order. */
  getServiceGroups(): Promise<ServiceGroup[]>;
  getServices(group?: ServiceGroupId): Promise<Service[]>;
  getService(id: string): Promise<Service | undefined>;
  /** Только непустые, по order. */
  getGalleryCategories(): Promise<GalleryCategory[]>;
  getGallery(category: ServiceGroupId): Promise<GalleryItem[]>;
  getSchedule(): Promise<Schedule>;
  getBusiness(): Promise<Business>;
}

const byOrder = <T extends { order: number }>(a: T, b: T): number => a.order - b.order;

/** Хранит проверенные данные из data/*.json в памяти. */
export class JsonCatalogRepository implements CatalogRepository {
  constructor(private readonly data: CatalogData) {}

  getMasters(group?: ServiceGroupId): Promise<Master[]> {
    if (group === undefined) return Promise.resolve([...this.data.masters]);
    const ids = new Set(
      this.data.services.filter((s) => s.group === group).flatMap((s) => s.masterIds),
    );
    return Promise.resolve(this.data.masters.filter((m) => ids.has(m.id)));
  }

  getMaster(id: string): Promise<Master | undefined> {
    return Promise.resolve(this.data.masters.find((m) => m.id === id));
  }

  getServiceGroups(): Promise<ServiceGroup[]> {
    return Promise.resolve([...this.data.groups].sort(byOrder));
  }

  getServices(group?: ServiceGroupId): Promise<Service[]> {
    const all = this.data.services;
    return Promise.resolve(group === undefined ? [...all] : all.filter((s) => s.group === group));
  }

  getService(id: string): Promise<Service | undefined> {
    return Promise.resolve(this.data.services.find((s) => s.id === id));
  }

  getGalleryCategories(): Promise<GalleryCategory[]> {
    const used = new Set(this.data.galleryItems.map((i) => i.category));
    return Promise.resolve(this.data.galleryCategories.filter((c) => used.has(c.id)).sort(byOrder));
  }

  getGallery(category: ServiceGroupId): Promise<GalleryItem[]> {
    return Promise.resolve(this.data.galleryItems.filter((i) => i.category === category));
  }

  getSchedule(): Promise<Schedule> {
    return Promise.resolve(this.data.schedule);
  }

  getBusiness(): Promise<Business> {
    return Promise.resolve(this.data.business);
  }
}
