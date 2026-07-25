# Sprint 1 Plan
**Product:** StudyPet-Plus | **Team:** StudyPet-Plus | **Sprint Period:** June 22–28, 2026 (Mon–Sun) | **Sprint Completion:** June 28, 2026 | **Rev:** 1.0 | **Rev Date:** June 22, 2026

## Sprint Goal
Stand up the project foundation and passwordless authentication: a user can sign in via a magic link, log out, and land on an empty protected dashboard on the live site.

## Team Capacity
- Team members: 5
- Planned available hours: 37.5h (5 members × 7.5h/sprint)
- Capacity buffer (15%): 5.5h
- Committed work hours: 32h

## Scope
- **Core committed scope:** 32 hours (US-1 through US-5)
- **Added scope recorded during the sprint:** None
- **Combined recorded scope:** 32 hours
- **MVP priority:** Land a working passwordless login and a protected, empty dashboard on the live deployment. The app shell and dev pipeline exist to support every later sprint, so they are treated as core, not polish.

## Team Roles
| Member | Role |
|--------|------|
| Aadi Elango | Scrum Master, Full-stack Developer |
| Jason Cheung | Product Owner, Full-stack Developer |
| Angela Yu | Full-stack Developer |
| Mia Wong | Full-stack Developer |
| Subhangi Chatterjee | Full-stack Developer |

## User Stories

### US-1: Passwordless Magic-Link Authentication — 8h
**User story:** As a user, I want to log in using a passwordless magic link so that I can securely access my account without managing a password.

**Acceptance criteria:**
1. A user can enter their email and request a single-use magic link.
2. Clicking the emailed link signs the user in and redirects to the dashboard.
3. The magic link expires after a short time or after one use.

| Task | Assignee | Estimate |
|------|----------|----------|
| Configure Auth.js with the email (magic-link) provider and server-side secrets | Jason | 3h |
| Build the login/request-link page and confirmation email template | Jason | 3h |
| Verify link expiration and single-use behavior end to end | Jason | 2h |
| **Story Total** |  | **8h** |

### US-2: Protected Dashboard — 6h
**User story:** As a user, I want the dashboard to require a valid session so that my account stays secure and only I can see it.

**Acceptance criteria:**
1. Unauthenticated users visiting the dashboard route are redirected to login.
2. Authenticated users land on an empty protected dashboard route.
3. A visible "Log out" control ends the session and returns the user to the login page.

| Task | Assignee | Estimate |
|------|----------|----------|
| Add session-aware route protection for the dashboard | Angela | 3h |
| Build the protected dashboard shell and "Log out" control | Angela | 3h |
| **Story Total** |  | **6h** |

### US-3: App Shell — 8h
**User story:** As a student, I want consistent navigation and a sidebar on every page so that I can move around the app without getting lost.

**Acceptance criteria:**
1. Authenticated routes render inside a shared layout with top navigation and sidebar.
2. The shell adapts responsively across mobile and desktop breakpoints.
3. Navigation links show where upcoming planner features will live.

| Task | Assignee | Estimate |
|------|----------|----------|
| Build the root layout, top navigation, and sidebar components | Mia | 4h |
| Wire responsive breakpoints and placeholder route links | Mia | 4h |
| **Story Total** |  | **8h** |

### US-4: Dev Pipeline — 6h
**User story:** As a student, I want the live site to always run a working, up-to-date build so that I can use StudyPet-Plus without hitting broken pages.

**Acceptance criteria:**
1. Pushing to the repository triggers automated lint and build checks.
2. A passing pipeline is required before merging to main, so broken code never reaches the live site.
3. Merges to main auto-deploy, so students see the latest working version.

| Task | Assignee | Estimate |
|------|----------|----------|
| Set up the CI workflow for lint and build checks | Subhangi | 3h |
| Configure the deployment pipeline to the live hosting environment | Subhangi | 3h |
| **Story Total** |  | **6h** |

### US-5: Demo Presentation — 4h
**User story:** As a course stakeholder, I want a guided walkthrough of the sign-in and dashboard flow so that I can see and verify the Sprint 1 functionality on the live site.

**Acceptance criteria:**
1. The demo walks through magic-link sign-in, the protected dashboard, and log-out on the live site.
2. Setup and demo steps are documented so any team member can present.
3. The walkthrough runs against the live deployment, not a local build.

| Task | Assignee | Estimate |
|------|----------|----------|
| Prepare the demo script and rehearse the login → dashboard → logout flow | Aadi | 2h |
| Document setup and demo steps for the sprint review | Aadi | 2h |
| **Story Total** |  | **4h** |

**Core committed total: 32 hours**

## Initial Scrum Board
| User Story | To Do | In Progress | Completed |
|------------|-------|-------------|-----------|
| US-1 Passwordless Magic-Link Auth | Auth.js config; login/request-link page; expiration/single-use checks | — | — |
| US-2 Protected Dashboard | Route protection; dashboard shell; logout control | — | — |
| US-3 App Shell | Root layout/nav/sidebar; responsive breakpoints; placeholder links | — | — |
| US-4 Dev Pipeline | CI lint/build workflow; deployment configuration | — | — |
| US-5 Demo Presentation | Demo script/rehearsal; setup documentation | — | — |

## Burnup Plan
| Date | Jun 22 | Jun 23 | Jun 24 | Jun 25 | Jun 26 | Jun 27 | Jun 28 |
|------|--------|--------|--------|--------|--------|--------|--------|
| Ideal completed hours | 6.4 | 12.8 | 19.2 | 25.6 | 32 | 32 | 32 |
| Actual completed hours | 0 | 6 | 14 | 22 | 32 | 32 | 32 |

## Definition of Done
- Functionality meets the relevant acceptance criteria.
- Magic-link sign-in, protected routing, and logout are verified end-to-end on the live deployment.
- Code is reviewed, tested as appropriate, and does not regress the core demo path.
- The Scrum board and burnup are updated at scrum meetings.
- Non-core scope is deferred when necessary to protect the core MVP.

## Scrum Schedule
| Day | Date | Time | Type |
|-----|------|------|------|
| Monday | June 22, 2026 | 9:00–10:00 AM | Sprint Planning |
| Wednesday | June 24, 2026 | 9:30–10:00 AM | Daily Scrum |
| Thursday | June 25, 2026 | 9:30–10:00 AM | **TA visit / plan check** |
| Friday | June 26, 2026 | 9:30–10:00 AM | Daily Scrum |
| Sunday | June 28, 2026 | 9:00–9:30 AM | Sprint Review / Demo + Retro |

### Key Milestones
| Milestone | Date |
|-----------|------|
| Sprint 1 starts | June 22, 2026 |
| TA visit / plan check | June 25, 2026 |
| Sprint review and completion | June 28, 2026 |
