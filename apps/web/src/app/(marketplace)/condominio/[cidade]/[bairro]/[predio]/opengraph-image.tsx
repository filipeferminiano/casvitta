import messages from '../../../../../../../messages/pt-BR.json';
import { formatBRL } from '@/lib/format';
import { getBuilding, isRedirect } from '@/lib/data/market';
import { OG_CONTENT_TYPE, OG_SIZE, marketOgImage } from '@/lib/market-og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 86400;

export default async function Image({
  params,
}: {
  params: Promise<{ cidade: string; bairro: string; predio: string }>;
}) {
  const { cidade, bairro, predio } = await params;
  const page = await getBuilding(cidade, bairro, predio);
  const ok = page && !isRedirect(page) ? page : null;
  const value = ok?.stats?.priced ? ok.stats.median_value_cents : null;
  return marketOgImage({
    eyebrow: ok ? `${ok.street.name}, ${ok.street_number} · ${ok.neighborhood.name}` : '',
    title: ok ? ok.building.name : messages.market.city.eyebrow,
    label: messages.market.og.medianValue,
    value: value != null ? formatBRL(value) : undefined,
    demo: ok?.source.is_demo,
  });
}
