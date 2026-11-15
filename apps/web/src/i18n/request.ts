import { getRequestConfig } from 'next-intl/server';

/** Only pt-BR for now; no locale in the URL. Keep the mechanism so more locales can be added. */
export const DEFAULT_LOCALE = 'pt-BR';
export const TIME_ZONE = 'America/Sao_Paulo';

export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  timeZone: TIME_ZONE,
  messages: (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default,
}));
