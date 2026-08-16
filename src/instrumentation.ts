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
}
