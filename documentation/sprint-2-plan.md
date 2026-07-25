# Sprint 2 Plan
**Product:** StudyPet-Plus | **Team:** StudyPet-Plus | **Sprint Period:** June 29–July 5, 2026 (Mon–Sun) | **Sprint Completion:** July 5, 2026 | **Rev:** 1.0 | **Rev Date:** June 29, 2026

## Sprint Goal
Deliver the planner core: a logged-in user manages courses and assignments, sees a planner dashboard sorted by due date, and sees their StudyPet on the dashboard.

## Team Capacity
- Team members: 5
- Planned available hours: 37.5h (5 members × 7.5h/sprint)
- Capacity buffer (15%): 5.5h
- Committed work hours: 32h

## Scope
- **Core committed scope:** 32 hours (US-1 through US-8)
- **Added scope recorded during the sprint:** None
- **Combined recorded scope:** 32 hours
- **MVP priority:** Land course, assignment, and quest CRUD with a planner dashboard and pet widget on the live site. Mobile responsiveness and CI fixes are required for demo readiness, not optional polish.

## Team Roles
| Member | Role |
|--------|------|
| Angela Yu | Scrum Master, Full-stack Developer |
| Jason Cheung | Product Owner, Full-stack Developer |
| Mia Wong | Full-stack Developer |
| Subhangi Chatterjee | Full-stack Developer |
| Aadi Elango | Full-stack Developer |

## User Stories

### US-1: Planner Data Persistence — 2.5h
**User story:** As a student, I want my courses, assignments, quests, and pet to be saved to my account so that my planner is still there when I come back.

**Acceptance criteria:**
1. Courses, assignments, quests, and the pet are stored against the signed-in user.
2. Data entered in one session is still present after logging out and back in.
3. A student can only read and write their own planner records.

| Task | Assignee | Hours |
|------|----------|-------|
| Design Course, Assignment, Quest, Pet schema (fields, relations to User, indexes) | Jason | 1.5h |
| Generate and apply the Prisma migration against the running Postgres | Jason | 1h |
| **Story Total** | | **2.5h** |

### US-2: Course Management — 5.5h
**User story:** As a student, I want to create, edit, and delete my courses so that I can organize assignments by class.

**Acceptance criteria:**
1. A student can create a course with a name and color tag, and edit or delete it later.
2. Courses are listed on the dashboard and reachable from the sidebar.
3. Deleting a course does not leave orphaned assignments visible in the planner.

| Task | Assignee | Hours |
|------|----------|-------|
| Course API routes: list / create / edit /delete, color tag | Mia | 2h |
| Course CRUD UI: list view, create/edit form | Mia | 2h |
| Course summary card + navigation wired into the dashboard and sidebar | Mia | 1.5h |
| **Story Total** | | **5.5h** |

### US-3: Assignment Tracking — 6h
**User story:** As a student, I want to create and track assignments tied to a course so that I know what's due and when.

**Acceptance criteria:**
1. An assignment can be created with a due date, status, and type, and linked to a course.
2. Assignments are viewable both course-scoped and in a global planner list.
3. Status can be changed inline from the list on desktop and mobile.

| Task | Assignee | Hours |
|------|----------|-------|
| Assignment API routes: course-scoped and global list/detail, with dueAt, status, type | Mia | 2h |
| Assignment list/detail UI (course-scoped + global planner views) | Mia | 2h |
| Inline status dropdown on assignment rows for instant updates, incl. mobile toggle | Mia | 1.5h |
| Formatting/bug fixes (due-date display, row formatting) | Mia | 0.5h |
| **Story Total** | | **6h** |

### US-4: Study Quests — 7h
**User story:** As a student, I want lightweight quests (study goals/tasks) with an XP reward so that my daily study work counts toward my pet's progress.

**Acceptance criteria:**
1. A student can create, edit, delete, and change the status of a quest.
2. Each quest carries an XP reward value that is stored with it.
3. Quest status and XP are visible from the quest list and the profile display.

| Task | Assignee | Hours |
|------|----------|-------|
| Quest API routes: list / create / edit / delete, status change | Subhangi | 2h |
| Quest CRUD UI: full list with status changes and delete | Subhangi | 2h |
| Settings/theme and profile/XP display polish | Subhangi | 2h |
| Bug fixes + lint formatting cleanup | Subhangi | 1h |
| **Story Total** | | **7h** |

### US-5: Planner Dashboard — 3h
**User story:** As a signed-in student, I want a planner dashboard so that I can see everything due at a glance.

**Acceptance criteria:**
1. The dashboard shows upcoming assignments and quests sorted by due date.
2. A "due this week" section and open-quest/streak stats are visible without scrolling on desktop.
3. An empty state is shown when the student has no courses or assignments yet.

| Task | Assignee | Hours |
|------|----------|-------|
| Dashboard page: stats, open quests / streak, due-this-week, upcoming assignments + quests + courses grid | Angela | 3h |
| **Story Total** | | **3h** |

### US-6: Pet Widget — 2h
**User story:** As a student, I want to see my StudyPet on the dashboard so that my study progress feels rewarding from day one.

**Acceptance criteria:**
1. The dashboard displays the signed-in student's pet with its current state.
2. A default pet is shown for a new account with no activity.
3. The widget renders correctly on mobile and desktop.

| Task | Assignee | Hours |
|------|----------|-------|
| PetSummary component + pet-display helper, wired into the dashboard | Angela | 2h |
| **Story Total** | | **2h** |

### US-7: Demo Seed Data — 1.5h
**User story:** As a course stakeholder, I want the demo account to open with realistic courses, assignments, and quests already in place so that I can evaluate the planner without setting up data first.

**Acceptance criteria:**
1. The seed script loads courses, assignments, quests, and a pet for the demo account.
2. Re-running the seed produces the same predictable data set.
3. The seeded dashboard shows a populated planner immediately after sign-in.

| Task | Assignee | Hours |
|------|----------|-------|
| Extend the existing seed script to load courses, assignments, quests, and a pet | Jason | 1.5h |
| **Story Total** | | **1.5h** |

### US-8: Mobile Planner — 4.5h
**User story:** As a student, I want to use the planner on my phone so that I can check and update what's due between classes.

**Acceptance criteria:**
1. Assignment tables collapse into readable card views on small screens.
2. Assignment status can be changed from a mobile device without horizontal scrolling.
3. No layout overflow or clipped controls at common mobile breakpoints.

| Task | Assignee | Hours |
|------|----------|-------|
| Mobile card views + responsive data tables for assignments | Aadi | 2h |
| Mobile UI enhancements and inline assignment status toggle | Aadi | 1h |
| Fix LF line endings to resolve CI lint failures; port the settings modal out of the sidebar DOM hierarchy and restore the dev build cache | Aadi | 1.5h |
| **Story Total** | | **4.5h** |

**Core committed total: 32 hours**

## Initial Scrum Board
| User Story | To Do | In Progress | Completed |
|------------|-------|-------------|-----------|
| US-1 Prisma Models | Schema design; migration apply | — | — |
| US-2 Course CRUD | API routes; list/form UI; dashboard wiring | — | — |
| US-3 Assignment CRUD | API routes; planner views; status dropdown | — | — |
| US-4 Quest CRUD | API routes; quest UI; settings polish | — | — |
| US-5 Planner Dashboard | Stats, streaks, due dates, courses grid | — | — |
| US-6 Pet Widget | PetSummary component; dashboard wiring | — | — |
| US-7 Demo Seed Script | Extend seed for courses, assignments, quests, pet | — | — |
| US-8 Mobile UI / CI Fixes | Responsive views; LF line endings; build cache | — | — |

## Burnup Plan
| Date | Jun 29 | Jun 30 | Jul 1 | Jul 2 | Jul 3 | Jul 4 | Jul 5 |
|------|--------|--------|-------|-------|-------|-------|-------|
| Ideal completed hours | 6.4 | 12.8 | 19.2 | 25.6 | 32 | 32 | 32 |
| Actual completed hours | 0 | 8 | 16 | 24 | 32 | 32 | 32 |

## Definition of Done
- Functionality meets the relevant acceptance criteria.
- Course, assignment, and quest CRUD are verified end-to-end on the live deployment.
- Code is reviewed, tested as appropriate, and does not regress the core demo path.
- The Scrum board and burnup are updated at scrum meetings.
- Non-core scope is deferred when necessary to protect the core MVP.

## Scrum Schedule
| Day | Date | Time | Type |
|-----|------|------|------|
| Monday | June 29, 2026 | 9:00–9:30 AM | Sprint Planning |
| Tuesday | June 30, 2026 | 9:00–9:30 AM | **TA visit** (weekly Tuesday check-in) |
| Wednesday | July 1, 2026 | 9:30–10:00 AM | Daily Scrum / mid-sprint sync |
| Friday | July 3, 2026 | 9:00–9:30 AM | Daily Scrum |
| Friday | July 3, 2026 | 9:30–10:00 AM | **TA visit** (weekly Friday check-in) |
| Sunday | July 5, 2026 | 9:00–9:30 AM | Sprint Review / Demo + Retro |

*All scrum slots are 30 minutes. TA visits are scheduled every Tuesday at 9:00 AM and Friday at 9:30 AM for the duration of the course.*

### Key Milestones
| Milestone | Date |
|-----------|------|
| Sprint 2 starts | June 29, 2026 |
| **TA visit** — plan check | June 30, 2026 |
| Mid-sprint sync | July 1, 2026 |
| **TA visit** — progress check | July 3, 2026 |
| Sprint review and completion | July 5, 2026 |
