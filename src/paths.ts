import { fileURLToPath } from 'node:url';

/** Корень проекта: на уровень выше src/ (и выше dist/), там лежат data/, locales/ и assets/. */
export const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
