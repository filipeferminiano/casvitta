import { redirect } from 'next/navigation';

/** app.casvitta.com.br/ opens Início. */
export default function AppIndex(): never {
  redirect('/inicio');
}
