import { getRequestConfig } from 'next-intl/server';

// Static import so the dev server reloads the catalog when it changes.
import ptBR from '../../messages/pt-BR.json';

/** Only pt-BR for now; no locale in the URL. Keep the mechanism so more locales can be added. */
export const DEFAULT_LOCALE = 'pt-BR';
export const TIME_ZONE = 'America/Sao_Paulo';

const CATALOGS = { 'pt-BR': ptBR } as const;

export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  timeZone: TIME_ZONE,
  messages: CATALOGS[DEFAULT_LOCALE],
}));
