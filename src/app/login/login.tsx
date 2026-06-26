import { signIn } from "@/auth";   // ← imported from auth.ts

export default function LoginPage() {
  return (
    <form
      action={async (formData) => {
        "use server";                       // runs on the server
        await signIn("nodemailer", {        // provider id from auth.ts
          email: formData.get("email") as string,
          redirectTo: "/dashboard",
        });
      }}
      className="flex flex-col gap-3 w-80 mx-auto mt-40"
    >
      <h1 className="text-xl font-semibold">Sign in to StudyPet+ 🐾</h1>
      <input name="email" type="email" required placeholder="you@example.com"
             className="border rounded px-3 py-2" />
      <button className="bg-black text-white rounded px-3 py-2">
        Send magic link
      </button>
    </form>
  );
}