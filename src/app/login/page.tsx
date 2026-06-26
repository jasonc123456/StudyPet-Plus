// NOTE: This file is named `login.tsx`, so it is NOT a route yet — only
// `page.tsx` files become routes in the App Router. Rename it to `page.tsx`
// (and uncomment the real version below) once auth.ts exists in Sprint 1.
//
// Real magic-link version, restore when `@/auth` is set up:
//
//   import { signIn } from "@/auth";
//
//   export default function LoginPage() {
//     return (
//       <form
//         action={async (formData) => {
//           "use server";
//           await signIn("nodemailer", {
//             email: formData.get("email") as string,
//             redirectTo: "/dashboard",
//           });
//         }}
//         className="mx-auto mt-40 flex w-80 flex-col gap-3"
//       >
//         <h1 className="text-xl font-semibold">Sign in to StudyPet+ 🐾</h1>
//         <input name="email" type="email" required placeholder="you@example.com"
//                className="rounded border px-3 py-2" />
//         <button className="btn-primary">Send magic link</button>
//       </form>
//     );
//   }

// Static placeholder so the project type-checks before auth is wired up.
export default function LoginPlaceholder() {
  return (
    <main className="mx-auto mt-40 flex w-80 flex-col gap-3 text-center">
      <h1 className="text-xl font-semibold">Sign in to StudyPet+ 🐾</h1>
      <p className="text-sm text-slate-500">
        Magic-link sign-in arrives in Sprint 1.
      </p>
    </main>
  );
}
