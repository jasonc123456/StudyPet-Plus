// Runs once when the server process boots, before it serves anything.
//
// Next calls register() on startup when experimental.instrumentationHook is on
// (see next.config.mjs). It is the only place that can fail a *deployment* on a
// runtime misconfiguration — next.config.mjs sees build-time env, which on this
// stack is not the same env the container runs with.

export async function register() {
  // Edge and Node runtimes both call this; the check only makes sense in Node,
  // and the import below is Node-only.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { assertSecureOriginInProduction } = await import('@/lib/site-url');
  assertSecureOriginInProduction();

  // The upload sweeper deliberately does NOT live here. This file is compiled
  // for the Edge runtime as well as Node, and anything it reaches — statically
  // or through a dynamic import — has to resolve in both. src/lib/note-pdf.ts
  // uses node:fs and node:path, so pulling it in from here fails the Edge
  // compile. It starts its own timer instead, on first import by a Node route.
}
