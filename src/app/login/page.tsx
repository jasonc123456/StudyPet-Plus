"use client";

// Passwordless magic-link sign-in. NextAuth v4's `signIn` is client-side: it
// posts the email to the Email provider (id "email"), which sends the link and
// redirects to the verify-request page. `callbackUrl` is where the user lands
// after clicking the link in their inbox.

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitting(true);
        signIn("email", { email, callbackUrl: "/dashboard" });
      }}
      className="mx-auto mt-40 flex w-80 flex-col gap-3"
    >
      <h1 className="text-xl font-semibold">Sign in to StudyPet+ 🐾</h1>
      <input
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded border px-3 py-2"
      />
      <button className="btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Send magic link"}
      </button>
    </form>
  );
}
