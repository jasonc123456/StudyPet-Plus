// Shown right after a user submits their email on /login. Auth.js redirects
// here once the magic link has been emailed. Purely presentational: a blue-sky
// scene with drifting clouds and the StudyPet pet waiting for you to click the
// link in your inbox.

import Image from "next/image";
import Link from "next/link";

import petImg from "./waiting-pet.png";

// A puffy white cloud composed from a few overlapping rounded blobs.
function Cloud({
  className,
  style,
}: {
  className: string;
  style?: React.CSSProperties;
}) {
  return (
    <div aria-hidden className={`absolute ${className}`} style={style}>
      <div className="relative h-12 w-32">
        <span className="absolute bottom-0 left-0 h-12 w-32 rounded-full bg-white/90" />
        <span className="absolute bottom-3 left-6 h-16 w-16 rounded-full bg-white/90" />
        <span className="absolute bottom-2 right-4 h-20 w-20 rounded-full bg-white/95" />
      </div>
    </div>
  );
}

const SPARKLES = [
  { pos: "left-0 top-3", delay: "0s" },
  { pos: "right-1 top-8", delay: "0.7s" },
  { pos: "right-5 bottom-3", delay: "1.3s" },
];

export default function VerifyRequestPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-sky-400 via-sky-200 to-sky-50 px-6">
      {/* Drifting clouds, pre-spread across the sky via negative delays. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <Cloud className="animate-cloud-slow" style={{ top: "10%" }} />
        <Cloud
          className="animate-cloud-med"
          style={{ top: "28%", animationDelay: "-12s" }}
        />
        <Cloud
          className="animate-cloud-fast"
          style={{ top: "60%", animationDelay: "-6s" }}
        />
        <Cloud
          className="animate-cloud-med"
          style={{ top: "78%", animationDelay: "-20s" }}
        />
      </div>

      <section className="animate-pop-in relative z-10 w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-8 text-center shadow-xl backdrop-blur">
        {/* Pet-waiting scene */}
        <div className="relative mx-auto mb-4 h-48 w-48">
          {/* Floating envelope with pulsing "waiting" dots */}
          <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
            <div className="animate-bob text-3xl" style={{ animationDelay: "0.5s" }}>
              ✉️
            </div>
            <div className="mt-1 flex justify-center gap-1">
              {["0s", "0.15s", "0.3s"].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400"
                  style={{ animationDelay: d }}
                />
              ))}
            </div>
          </div>

          {SPARKLES.map((s) => (
            <span
              key={s.pos}
              aria-hidden
              className={`animate-twinkle absolute text-xl ${s.pos}`}
              style={{ animationDelay: s.delay }}
            >
              ✨
            </span>
          ))}

          <Image
            src={petImg}
            alt="Your StudyPet puppy waiting for you"
            priority
            className="animate-bob mx-auto h-48 w-auto drop-shadow-lg"
          />
        </div>

        <h1 className="bg-gradient-to-r from-sky-600 to-brand-600 bg-clip-text text-2xl font-extrabold text-transparent">
          Check your email
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Your pet is waiting! We sent a magic link to sign in to StudyPet+. Open
          it on this device to continue &mdash; you can close this tab.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block text-sm font-medium text-brand-600 underline-offset-4 transition hover:text-brand-700 hover:underline"
        >
          Use a different email
        </Link>
      </section>
    </main>
  );
}
