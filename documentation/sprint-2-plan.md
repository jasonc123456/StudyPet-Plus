# Sprint 2 Plan
**Product:** StudyPet+ | **Team:** StudyPet+ | **Due:** July 3, 2026 | **Rev:** 1.0 | **Rev Date:** July 6, 2026

## Sprint Goal
Deliver the planner core: a logged-in user manages courses and assignments, sees a planner dashboard sorted by due date, and sees their StudyPet on the dashboard.

## Team Capacity
- Committed hours: 32 ideal hours

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

**Total committed: 32 ideal hours**

## Scrum Schedule
| Day | Time | Type |
|-----|------|------|
| Monday | 1 hr (+30m TA session) | Sprint Planning |
| Wednesday | 30m | Mid-sprint sync |
| Friday | 30m (+30m TA session) | Sprint Review / Demo + Retro |
| Daily | Async | Daily standup via Discord thread |