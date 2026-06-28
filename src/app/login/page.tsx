import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <form
      action={async (formData) => {
        "use server";
        await signIn("nodemailer", {
          email: formData.get("email") as string,
          redirectTo: "/dashboard",
        });
      }}
      className="mx-auto mt-40 flex w-80 flex-col gap-3"
    >
      <h1 className="text-xl font-semibold">Sign in to StudyPet+ 🐾</h1>
      <input
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="rounded border px-3 py-2"
      />
      <button className="btn-primary">Send magic link</button>
    </form>
  );
}
