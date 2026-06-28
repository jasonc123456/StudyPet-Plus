// Shown right after a user submits their email on /login. Auth.js redirects
// here (configured via `pages.verifyRequest` in src/auth.ts) once the magic
// link has been emailed.

import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <main className="mx-auto mt-40 flex w-80 flex-col gap-3 text-center">
      <h1 className="text-xl font-semibold">Check your email 📬</h1>
      <p className="text-sm text-slate-500">
        We sent you a magic link to sign in to StudyPet+. Open it on this device
        to continue. You can close this tab.
      </p>
      <Link href="/login" className="text-sm text-slate-400 underline">
        Use a different email
      </Link>
    </main>
  );
}
