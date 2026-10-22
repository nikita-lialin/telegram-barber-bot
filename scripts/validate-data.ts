import { CatalogError, loadCatalog } from '../src/data/loader.js';
import { PROJECT_ROOT } from '../src/paths.js';

try {
  const data = loadCatalog(PROJECT_ROOT);
  const categories = new Set(data.galleryItems.map((i) => i.category));
  console.log(
    `OK: мастеров ${data.masters.length}, групп ${data.groups.length}, услуг ${data.services.length}, ` +
      `фото ${data.galleryItems.length} в ${categories.size} категориях`,
  );
} catch (err) {
  if (err instanceof CatalogError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
