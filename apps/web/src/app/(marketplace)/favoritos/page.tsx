import {
  MarketplacePlaceholder,
  placeholderMetadata,
} from '@/screens/marketplace/MarketplacePlaceholder';

export const generateMetadata = () => placeholderMetadata('favorites');

export default function Page() {
  return <MarketplacePlaceholder section="favorites" />;
}
