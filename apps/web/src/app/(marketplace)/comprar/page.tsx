import {
  MarketplacePlaceholder,
  placeholderMetadata,
} from '@/screens/marketplace/MarketplacePlaceholder';

export const generateMetadata = () => placeholderMetadata('buy');

export default function Page() {
  return <MarketplacePlaceholder section="buy" />;
}
