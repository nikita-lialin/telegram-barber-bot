import { Composer } from 'grammy';
import type { BotContext } from '../../context.js';
import type { CatalogRepository } from '../../data/repository.js';
import { currentLocale } from '../../i18n/index.js';
import { decode } from '../../ui/callback.js';
import { renderScreen } from '../../ui/render.js';
import { galleryPhotoScreen, galleryScreen } from './view.js';

/**
 * Раздел «Наши работы»: категории и альбом с листанием. Неизвестная категория, категория
 * без фото и индекс вне диапазона не обрабатываются здесь, а уходят дальше в fallback.
 */
export function createGalleryFeature(catalog: CatalogRepository): Composer<BotContext> {
  const feature = new Composer<BotContext>();

  feature.callbackQuery(/^g(:|$)/, async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    const locale = currentLocale(ctx);

    if (route?.kind === 'gallery') {
      await ctx.answerCallbackQuery();
      await renderScreen(ctx, galleryScreen(ctx, locale, await catalog.getGalleryCategories()));
      return;
    }

    if (route?.kind === 'galleryPhoto') {
      const categories = await catalog.getGalleryCategories();
      const category = categories.find((c) => c.id === route.category);
      if (category === undefined) return next();
      const items = await catalog.getGallery(category.id);
      const screen = galleryPhotoScreen(ctx, locale, categories, category, items, route.index);
      if (screen === undefined) return next();
      await ctx.answerCallbackQuery();
      await renderScreen(ctx, screen);
      return;
    }

    return next();
  });

  return feature;
}
