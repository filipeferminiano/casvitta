import { redirect } from 'next/navigation';

/** Visão geral arrives with BO1; until then the team screen is home. */
export default function BackofficeHome() {
  redirect('/equipe');
}
