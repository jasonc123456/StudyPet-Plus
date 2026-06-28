// Protected landing page after a successful magic-link sign-in
// (signIn redirects here with redirectTo: "/dashboard").
//
// Server component: reads the database-backed session via `auth()`. If there's
// no session we bounce to /login, so this route is effectively gated without
// needing separate middleware.

import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto mt-40 flex w-80 flex-col gap-4 text-center">
      <h1 className="text-xl font-semibold">Welcome to StudyPet+ 🐾</h1>
      <p className="text-sm text-slate-500">
        Signed in as {session.user.email}
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button className="btn-primary">Sign out</button>
      </form>
    </main>
  );
}
