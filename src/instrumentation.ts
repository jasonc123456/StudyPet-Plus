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

  scheduleUploadSweep();
}

/** How often abandoned note uploads are cleared off disk. */
const UPLOAD_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Clear abandoned note uploads on a timer.
 *
 * The upload path sweeps opportunistically too, but that only fires while
 * someone is uploading — an instance that goes quiet with expired files still
 * holding disk would never clean them up. `unref()` so this never holds the
 * process open on shutdown.
 */
function scheduleUploadSweep() {
  const sweep = async () => {
    try {
      const { sweepExpiredUploads } = await import('@/lib/note-pdf');
      const removed = await sweepExpiredUploads();
      if (removed > 0) {
        console.info(`[uploads] swept ${removed} expired upload(s)`);
      }
    } catch (error) {
      // A failed sweep is not worth taking the server down for; the next tick
      // and the next upload both retry.
      console.error('[uploads] sweep failed', error);
    }
  };

  setInterval(sweep, UPLOAD_SWEEP_INTERVAL_MS).unref();
  void sweep();
}
