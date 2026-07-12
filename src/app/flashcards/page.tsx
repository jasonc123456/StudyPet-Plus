import { redirect } from 'next/navigation';

/** Legacy sidebar path — send users into the dashboard shell. */
export default function FlashcardsRedirectPage() {
  redirect('/dashboard/flashcards');
}
