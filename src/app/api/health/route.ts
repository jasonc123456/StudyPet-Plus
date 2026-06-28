// GET /api/health — liveness + DB connectivity probe.
//
// Returns 200 with { status: "ok", db: "up" } when the app can reach Postgres,
// or 503 with { status: "error", db: "down" } when the query fails. Used by the
// Sprint 1 smoke test and handy for uptime monitoring / deploy verification.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Never cache a health check — always hit the DB live.
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    // Cheapest possible round-trip that proves the connection works.
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "up",
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Don't leak connection strings / internals to the client; log server-side.
    console.error("[/api/health] DB check failed:", err);
    return NextResponse.json(
      {
        status: "error",
        db: "down",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}