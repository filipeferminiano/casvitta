import type { MetadataRoute } from 'next';

import { requestSite } from '@/lib/request-site';
import { robotsFor } from '@/lib/seo';

/**
 * Marketplace and landing hosts: capture pages are indexable; signup, sign-in and
 * confirmation are not. The Broker OS host and non-production deploys are never indexed.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { site, origin, isProductionDomain } = await requestSite();
  return robotsFor(site, origin, isProductionDomain);
}
