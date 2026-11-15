import {
  MarketplacePlaceholder,
  placeholderMetadata,
} from '@/screens/marketplace/MarketplacePlaceholder';

export const generateMetadata = () => placeholderMetadata('terms');

export default function Page() {
  return <MarketplacePlaceholder section="terms" />;
}
