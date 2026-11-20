import messages from '../../../../../../../messages/pt-BR.json';
import { getStreet, isRedirect } from '@/lib/data/market';
import { formatPriceM2 } from '@/lib/market-format';
import { OG_CONTENT_TYPE, OG_SIZE, marketOgImage } from '@/lib/market-og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 86400;

export default async function Image({
  params,
}: {
  params: Promise<{ cidade: string; bairro: string; rua: string }>;
}) {
  const { cidade, bairro, rua } = await params;
  const page = await getStreet(cidade, bairro, rua);
  const ok = page && !isRedirect(page) ? page : null;
  const price = ok?.stats?.median_price_m2_cents;
  return marketOgImage({
    eyebrow: ok ? ok.neighborhood.name : messages.market.city.eyebrow,
    title: ok ? ok.street.name : messages.market.city.eyebrow,
    label: messages.market.og.priceM2,
    value: price != null ? formatPriceM2(price) : undefined,
    demo: ok?.source.is_demo,
  });
}
