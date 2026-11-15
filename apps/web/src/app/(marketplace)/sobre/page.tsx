import {
  MarketplacePlaceholder,
  placeholderMetadata,
} from '@/screens/marketplace/MarketplacePlaceholder';

export const generateMetadata = () => placeholderMetadata('about');

export default function Page() {
  return <MarketplacePlaceholder section="about" />;
}
