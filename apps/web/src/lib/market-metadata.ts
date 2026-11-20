import type { Metadata } from 'next';

/**
 * Price pages: title, description, canonical and robots from the API gate. Below the gate (or in
 * a neighborhood not yet flagged indexable): noindex, but links are followed. No `images` here:
 * the route's opengraph-image.tsx provides a card with the page's headline number.
 */
export function marketMetadata({
  title,
  description,
  path,
  indexable,
}: {
  title: string;
  description: string;
  path: string;
  indexable: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
  };
}
