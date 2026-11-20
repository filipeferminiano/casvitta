import messages from '../../../../../../messages/pt-BR.json';
import { formatBRL } from '@/lib/format';
import { getFinancing, isRedirect } from '@/lib/data/market';
import { OG_CONTENT_TYPE, OG_SIZE, marketOgImage } from '@/lib/market-og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 86400;

export default async function Image({
  params,
}: {
  params: Promise<{ cidade: string; bairro: string }>;
}) {
  const { cidade, bairro } = await params;
  const page = await getFinancing(cidade, bairro);
  const ok = page && !isRedirect(page) ? page : null;
  const sac = ok?.simulations.find((s) => s.system === 'sac');
  return marketOgImage({
    eyebrow: messages.market.financing.eyebrow,
    title: ok
      ? messages.market.financing.title.replace('{name}', ok.neighborhood.name)
      : messages.market.financing.eyebrow,
    label: messages.market.og.minIncome,
    value: sac ? formatBRL(sac.min_income_cents) : undefined,
    demo: ok?.source.is_demo,
  });
}
