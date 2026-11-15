import {
  MarketplacePlaceholder,
  placeholderMetadata,
} from '@/screens/marketplace/MarketplacePlaceholder';

export const generateMetadata = () => placeholderMetadata('signIn');

export default function Page() {
  return <MarketplacePlaceholder section="signIn" />;
}
