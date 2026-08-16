// Guards the Server Action authentication boundary.
//
// The MFA gate was centralised in requireUser() for API routes, but Server
// Actions call a different entry point, and six exported flashcard actions kept
// calling auth() directly — so a session that had not cleared its second factor
// could still drive AI generation and mutate decks. Centralising the policy only
// helps if nothing goes around it, which is what this asserts: no module marked
// 'use server' may reach for auth() itself.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC_DIR = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : [];
  });
}

const serverActionModules = walk(SRC_DIR).filter((file) =>
  /^\s*['"]use server['"]/.test(readFileSync(file, 'utf8'))
);

describe('server action modules', () => {
  it('finds the modules it is meant to be guarding', () => {
    // A rename that empties this list would make every assertion below vacuous.
    expect(serverActionModules.length).toBeGreaterThan(0);
  });

  it.each(serverActionModules)(
    '%s authenticates via requireActionUser, not auth()',
    (file) => {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/\bawait auth\(\)/);
      expect(source).toContain('requireActionUser');
    }
  );
});
