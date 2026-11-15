import {
  MarketplacePlaceholder,
  placeholderMetadata,
} from '@/screens/marketplace/MarketplacePlaceholder';

export const generateMetadata = () => placeholderMetadata('visits');

export default function Page() {
  return <MarketplacePlaceholder section="visits" />;
}
