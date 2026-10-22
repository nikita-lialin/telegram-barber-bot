/** Функция перевода, которую домен получает снаружи: сам он ни grammY, ни i18n не импортирует. */
export type Translate = (key: string, params?: Record<string, string | number>) => string;
