import {
  MarketplacePlaceholder,
  placeholderMetadata,
} from '@/screens/marketplace/MarketplacePlaceholder';

export const generateMetadata = () => placeholderMetadata('rent');

export default function Page() {
  return <MarketplacePlaceholder section="rent" />;
}
