import {
  MarketplacePlaceholder,
  placeholderMetadata,
} from '@/screens/marketplace/MarketplacePlaceholder';

export const generateMetadata = () => placeholderMetadata('privacy');

export default function Page() {
  return <MarketplacePlaceholder section="privacy" />;
}
