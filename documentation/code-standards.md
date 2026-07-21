# Code Standards
**Team:** StudyPet-Plus | **Stack:** TypeScript, React 18, Next.js 14 (App Router), Prisma, Tailwind CSS | **Version:** 1.0 | **Date:** July 21, 2026

## Style Guide Reference

We follow the **Next.js / React TypeScript conventions** and enforce them with **ESLint (`next/core-web-vitals`) + Prettier** via `plugin:prettier/recommended` (`npm run lint`).

TypeScript runs in `strict` mode (`tsconfig.json`). Formatting rules live in `.prettierrc` and are applied by ESLint, so a formatting mistake is a lint error — there is no separate format step to forget.

CI (`.github/workflows/ci.yml`) runs `prisma generate` → `npm run lint` → `npm run build` on every push to `main` and every pull request. Locally, `npm run check-deploy` runs the same three steps.

## Naming Conventions

| Type | Convention | Example (from this codebase) |
|------|-----------|------------------------------|
| Variables | camelCase | `authResult`, `completedCredits` |
| Boolean variables & predicates | `is`/`has`/`can` prefix | `isGroupAdmin()`, `isMfaActive()`, `isPrivateAddress()` |
| Functions | verb + noun, camelCase | `jsonError()`, `requireUser()`, `zodFirstError()` |
| Data-shaping helpers | `get` / `build` / `format` prefix | `getOwnedCourse()`, `buildNoteListWhere()`, `formatGpa()` |
| React components | PascalCase, one per file, file named after it | `DashboardPanel.tsx`, `StatTile.tsx` |
| Component prop types | `<ComponentName>Props` | `DashboardSectionHeaderProps`, `StatTileProps` |
| Dynamic route params type | `RouteContext` | `type RouteContext = { params: { itemId: string } }` |
| Hooks | `use` prefix, camelCase file | `useLivePet.ts`, `usePetProgress.ts` |
| Constants | UPPER_SNAKE_CASE, `as const` | `COURSE_COLORS`, `STATUS_BADGE_STYLES`, `PROVIDER_CHAIN` |
| Types/Interfaces | PascalCase, no `I` prefix | `CalendarSyncResult`, `PetStageDisplay` |
| Library/util modules | kebab-case | `api-response.ts`, `pet-xp.constants.ts` |
| Zod schemas | camelCase, `Schema` suffix | `updateGradeProfileSchema`, `createGroupInviteSchema` |
| Test files | `<module>.test.ts` beside the module | `quizzes.test.ts`, `pet-xp.constants.test.ts` |

**No magic numbers or magic strings.** Allowed values are declared once in `src/lib/constants.ts` and reused by both the Zod validators and the UI — use `DEFAULT_ASSIGNMENT_STATUS`, not `'todo'`, and `ASSIGNMENT_STATUS_VALUES`, not a re-typed array of strings. HTTP statuses are passed explicitly to `jsonError(message, 400)` so intent is visible at the call site.

## Formatting

Defined in `.prettierrc` and enforced by `npm run lint`:

- **Indentation:** 2 spaces (no tabs)
- **Quotes:** single quotes for strings; template literals for interpolation; double quotes in JSX attributes
- **Semicolons:** always required
- **Trailing commas:** ES5 style (objects, arrays — not function params)
- **Line endings:** LF
- **Braces:** opening brace on the same line as the declaration
- **Line length:** keep lines readable; let Prettier wrap rather than hand-formatting

**Import order:** external packages first, then internal `@/` aliases, separated by a blank line. Always use the `@/*` path alias (mapped to `./src/*`) instead of deep relative paths like `../../lib/prisma`.

```ts
import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedGradeItem } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
```

## Project Structure

Put new code where its neighbours already live:

| Path | Contains |
|------|----------|
| `src/app/` | App Router pages, layouts, and `api/*/route.ts` handlers |
| `src/app/actions/` | Server actions (`createFlashcardAction`, …) |
| `src/components/<feature>/` | React components grouped by feature (`flashcards`, `grades`, `quests`, …) |
| `src/components/common/` | Feature-agnostic reusable UI (`Chip`, `StatTile`, `ProgressBar`) |
| `src/lib/` | Framework-free business logic, formatting, and data access helpers |
| `src/lib/ai/` | AI provider layer, generation, prompts, and streaming |
| `src/hooks/` | Shared React hooks |
| `src/systems/` | Game-system rules (e.g. pet evolution) |
| `src/types/` | Ambient/global type declarations |
| `prisma/` | Schema, migrations, and seed script |

Logic that does not need React belongs in `src/lib`, not inside a component — that is what makes it unit-testable without rendering. The knowledge graph confirms this layering holds today: **no import cycles are present**, and keeping it that way is a review criterion.

## Reuse the Core Abstractions

Graph analysis of the repository identifies these as the most-depended-on functions. Before writing a new helper, check whether one of these already covers the need — re-implementing them inline is the most common review rejection:

| Helper | Module | Purpose |
|--------|--------|---------|
| `requireUser()` | `lib/api-response.ts` | Session guard for every API route |
| `jsonOk()` / `jsonError()` | `lib/api-response.ts` | The only sanctioned response builders |
| `zodFirstError()` | `lib/validators.ts` | Turns a Zod error into a user-facing message |
| `auth()` | `auth.ts` | Session access in pages and server components |
| `getGroupMembership()` / `isGroupAdmin()` | `lib/groups.ts` | Group access control |
| `getOwnedCourse()` and siblings | `lib/planner.ts` | Ownership checks before mutating a record |
| `PageHeader()` | `components/courses/PageHeader.tsx` | Standard page title/description/action row |
| `recordStudyActivity()` | `lib/pet-xp.ts` | Streak and XP side effects |

## API Route Conventions

Every `route.ts` handler follows the same shape:

1. Authenticate with `requireUser()` **outside** the main `try/catch` block and bail out on the returned `NextResponse`. Keeping auth outside the catch ensures `401 Unauthorized` responses pass through cleanly without being wrapped in a generic `500` error handler.
2. Wrap the remaining handler logic (database queries, external calls) in a `try/catch`. Log with the route name as prefix (`console.error('GET /api/assignments', error)`) and return `jsonError('Failed to …', 500)` — internal error text must never reach the client. Parse the request body in its own inner `try/catch`, returning `jsonError('Invalid JSON body', 400)` on failure.
3. Validate with a Zod schema via `safeParse`, returning `zodFirstError(parsed.error)` on failure.
4. For records owned by a user, load through an ownership helper (`getOwnedCourse`, `getOwnedGradeItem`, `getGroupMembership`) and return a **404** when it comes back empty — never leak the existence of another user's row.
5. Query through the shared `prisma` client, always scoped by the authenticated `user.id`.
6. Return `jsonOk(data)`.

Never construct `NextResponse.json` ad hoc in a route — use `jsonOk` / `jsonError` so response shapes stay consistent. Never trust a client-supplied user or owner id; take it from the session.

## Component Conventions

- Prefer **Server Components**; add `'use client'` only when the component needs state, effects, or browser APIs.
- Type props with a local `type <Name>Props = { ... }` declared directly above the component.
- Give optional props **default values in the destructuring** (`padding = true`, `linkLabel = 'View all'`) rather than branching inside the body.
- Export named components (`export function DashboardPanel`), not default exports.
- Style with **Tailwind utility classes**; compose conditional classes with a filtered array join rather than nested ternaries in the JSX. Style lookup maps (`STATUS_BADGE_STYLES`, `HIGHLIGHT_STYLES`) live as module constants, not inline objects.
- **Mobile Touch Targets:** All interactive elements (`<button>`, `<a>`, clickable badges, swatches) must maintain a minimum hit area of 44×44px (`min-h-11` or equivalent padding) on mobile viewports to comply with US-4.11 / US-4.13 standards.
- Feature components stay in their feature folder; promote to `components/common/` only once a second feature imports them.

## Security Standards

- **Authenticate then authorize.** `requireUser()` proves *who*; an ownership or membership helper proves *what they may touch*. Both are required for any record-scoped route.
- **Enforce Module Boundaries:** Never import server-only utility modules (such as `@/lib/prisma` or `auth.ts`) inside files marked with `'use client'`.
- **Validate every external input** with Zod before it reaches Prisma. Type annotations are not validation.
- **Guard outbound fetches.** User-supplied URLs (ICS calendar feeds) go through `assertPublicHttpUrl()` / `isPrivateAddress()` in `lib/calendar.ts` to block SSRF against private ranges, and responses are read with `readCappedText()`. Any new user-supplied-URL feature must reuse these.
- **Never store raw tokens.** Invite tokens follow `createRawInviteToken()` → `hashInviteToken()`; only the hash is persisted.
- **Never commit secrets.** All credentials come from environment variables; CI uses explicit non-production placeholders.

## Best Practices

- **DRY:** Extract repeated logic into `src/lib`. If the same expression appears three times, it becomes a helper.
- **Single Responsibility:** Each function, component, and module does one thing. If describing it needs more than one paragraph, split it.
- **Watch module size.** `lib/validators.ts` (772 lines) and `lib/ai/planner-import.ts` (1004 lines) are the largest modules and show low internal cohesion in graph analysis. Add new schemas to a feature-scoped module rather than growing these further.
- **Clarity over cleverness:** Write for the next reader. Avoid one-liners that sacrifice readability.
- **Type safety:** No `any`. Use `unknown` for unparsed input (as the route handlers do) and narrow it. Do not use `@ts-ignore` to silence a real error.
- **No commented-out code:** Delete it. Git history preserves it.
- **Comments explain *why*, not *what*.** Use `/** ... */` for exported helpers whose contract is non-obvious (e.g. *"Returns the session user or a 401 response — never both."*).
- **Keep the graph current:** after modifying code, run `graphify update .` so `graphify-out/` stays in sync.

## Definition of Done Checklist

Before opening a pull request:

- [ ] `npm run lint` passes with no new errors or warnings
- [ ] `npm run build` succeeds
- [ ] Unit tests pass (`npx vitest run`) and new logic in `src/lib` has test coverage
- [ ] New routes use `requireUser()` + an ownership check, and validate input with Zod
- [ ] No new import cycles introduced
- [ ] Prisma schema changes ship with a migration
- [ ] No secrets, debug `console.log`, or commented-out code in the diff
- [ ] Reviewed and approved by at least one other team member

See [definition-of-done.md](definition-of-done.md) for the full task, story, and sprint-level criteria.
