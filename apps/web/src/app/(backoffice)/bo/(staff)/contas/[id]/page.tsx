import { AccountScreen } from '@/screens/backoffice/AccountsScreens';

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccountScreen id={id} />;
}
