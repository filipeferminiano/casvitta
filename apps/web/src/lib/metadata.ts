import type { Metadata } from 'next';

export const OG_IMAGE = { url: '/api/og', width: 1200, height: 630 };

/** Metadata for a public page: title, description, canonical and the social card. */
export function publicMetadata({
  title,
  description,
  path,
  noindex = false,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  /** The title already carries the brand ("… | Casvitta"): skip the layout template. */
  absoluteTitle?: boolean;
}): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, images: [OG_IMAGE] },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
