# Sprint 2 Plan
**Product:** StudyPet-Plus | **Team:** StudyPet-Plus | **Sprint Period:** June 29–July 3, 2026 | **Sprint Completion:** July 3, 2026 | **Rev:** 1.0 | **Rev Date:** June 29, 2026

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

### US-1: As a developer, I want the Course/Assignment/Quest/Pet data model in place so that every planner feature has somewhere to persist data.
| Task | Assignee | Hours |
|------|----------|-------|
| Design Course, Assignment, Quest, Pet schema (fields, relations to User, indexes) | Jason | 1.5h |
| Generate and apply the Prisma migration against the running Postgres | Jason | 1h |
| **Story Total** | | **2.5h** |

### US-2: As a student, I want to create, edit, and delete my courses so that I can organize assignments by class.
| Task | Assignee | Hours |
|------|----------|-------|
| Course API routes: list / create / edit /delete, color tag | Mia | 2h |
| Course CRUD UI: list view, create/edit form | Mia | 2h |
| Course summary card + navigation wired into the dashboard and sidebar | Mia | 1.5h |
| **Story Total** | | **5.5h** |

### US-3: As a student, I want to create and track assignments tied to a course so that I know what's due and when.
| Task | Assignee | Hours |
|------|----------|-------|
| Assignment API routes: course-scoped and global list/detail, with dueAt, status, type | Mia | 2h |
| Assignment list/detail UI (course-scoped + global planner views) | Mia | 2h |
| Inline status dropdown on assignment rows for instant updates, incl. mobile toggle | Mia | 1.5h |
| Formatting/bug fixes (due-date display, row formatting) | Mia | 0.5h |
| **Story Total** | | **6h** |

### US-4: As a student, I want lightweight quests (study goals/tasks) with an XP reward field so that daily study work feeds the gamification system later.
| Task | Assignee | Hours |
|------|----------|-------|
| Quest API routes: list / create / edit / delete, status change | Subhangi | 2h |
| Quest CRUD UI: full list with status changes and delete | Subhangi | 2h |
| Settings/theme and profile/XP display polish | Subhangi | 2h |
| Bug fixes + lint formatting cleanup | Subhangi | 1h |
| **Story Total** | | **7h** |

### US-5: As a signed-in student, I want a planner dashboard so that I can see everything due at a glance.
| Task | Assignee | Hours |
|------|----------|-------|
| Dashboard page: stats, open quests / streak, due-this-week, upcoming assignments + quests + courses grid | Angela | 3h |
| **Story Total** | | **3h** |

### US-6: As a student, I want to see my StudyPet on the dashboard so that the gamification loop feels present from day one.
| Task | Assignee | Hours |
|------|----------|-------|
| PetSummary component + pet-display helper, wired into the dashboard | Angela | 2h |
| **Story Total** | | **2h** |

### US-7: As a team, we want seeded demo data so that every sprint demo is predictable.
| Task | Assignee | Hours |
|------|----------|-------|
| Extend the existing seed script to load courses, assignments, quests, and a pet | Jason | 1.5h |
| **Story Total** | | **1.5h** |

### US-8: As a team, we want the planner UI to work well on mobile so that the demo holds up on any device.
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
| Date | Jun 29 | Jun 30 | Jul 1 | Jul 2 | Jul 3 |
|------|--------|--------|-------|-------|-------|
| Ideal completed hours | 6.4 | 12.8 | 19.2 | 25.6 | 32 |
| Actual completed hours | 0 | 8 | 16 | 24 | 32 |

## Definition of Done
- Functionality meets the relevant acceptance criteria.
- Course, assignment, and quest CRUD are verified end-to-end on the live deployment.
- Code is reviewed, tested as appropriate, and does not regress the core demo path.
- The Scrum board and burnup are updated at scrum meetings.
- Non-core scope is deferred when necessary to protect the core MVP.

## Scrum Schedule
| Day | Time | Type |
|-----|------|------|
| Monday | 1 hr (+30m TA session) | Sprint Planning |
| Wednesday | 30m | Mid-sprint sync |
| Friday | 30m (+30m TA session) | Sprint Review / Demo + Retro |
| Daily | Async | Daily standup via Discord thread |

### Key Milestones
| Milestone | Date |
|-----------|------|
| Sprint 2 starts | June 29, 2026 |
| Mid-sprint sync | July 1, 2026 |
| Sprint review and completion | July 3, 2026 |
