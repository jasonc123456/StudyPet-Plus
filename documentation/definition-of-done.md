# Definition of Done
**Team:** StudyPet-Plus | **Version:** 1.0 | **Date:** July 19, 2026

## Task-Level Definition of Done
*"Did we build the thing right?" (Engineering perspective)*

A task is considered done when ALL of the following are true:
- [ ] Code is committed and pushed to the appropriate feature branch
- [ ] Code has been reviewed and approved by at least one other team member (pull request approved)
- [ ] All unit tests pass locally (`npx vitest run`). Note: CI (`.github/workflows/ci.yml`) currently runs `prisma generate` → `npm run lint` → `npm run build` only; the test suite is not yet wired into the pipeline.
- [ ] No new ESLint or TypeScript errors are introduced (run `npm run lint` and `npm run build`; there is no separate `type-check` script — `next build` performs the type check)
- [ ] Database schema or Prisma changes are migrated and documented
- [ ] External/public API routes (Next.js API handlers) are documented in the README or API docs

## User Story-Level Definition of Done
*"Did we build the right thing?" (User perspective)*

A user story is considered done when ALL of the following are true:
- [ ] All engineering tasks for the story are marked complete on the board
- [ ] All acceptance criteria for the story have been tested and pass
- [ ] Core flows are tested in the deployed StudyPet environment (login, dashboard, relevant UI interactions)
- [ ] Feature has been demonstrated to and accepted by the Product Owner
- [ ] Feature branch is merged into `main` via pull request
- [ ] No regression is observed in previously passing system or end-to-end tests
