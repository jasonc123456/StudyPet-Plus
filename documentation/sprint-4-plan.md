# Sprint 4 Plan
**Product:** StudyPet-Plus | **Team:** StudyPet-Plus | **Sprint Period:** July 15–22, 2026 | **Sprint Completion:** July 22, 2026 | **Rev:** 1.0 | **Rev Date:** July 15, 2026

## Sprint Goal
Students can take generated quizzes and receive scored results that persist to the database. They can view per-topic performance analytics to identify weak areas and receive a "review next" recommendation. Study activity awards XP (quizzes, flashcards, quests), tracks daily streaks, and drives a live StudyPet that reflects progress and evolves across stages for the final demo-ready end-to-end experience. Enable a full user journey: Take quiz → get score view weak topics→ get recommendation → earn XP → see pet evolve.

## Team Capacity
- Team members: 5
- Planned available hours: 65h (5 members × 13h/sprint)
- Capacity buffer (15%): 10h
- Committed work hours: 55h

## Scope
- **Core committed scope:** 37 story points (US-4.01 through US-4.10)
- **Added scope recorded during the sprint:** 18 story points (US-4.11 through US-4.15)
- **Combined recorded scope:** 55 story points

## Team Roles
| Member | Role |
|--------|------|
| Jason | Product Owner, Developer |
| Subhangi | Scrum Master, Developer |
| Mia | Developer |
| Angela | Developer |
| Aadithya | Developer |

## User Stories

### US-4.01: Quiz Taking — 5 points
**User story:** As a student, I want to take a generated quiz so that I can test my knowledge.

| Task | Assignee |
|------|----------|
| Implement quiz-taking UI, answer selection, and submission handling | Jason |
| Implement scoring logic and persistence of QuizAttempt and QuestionResult | Jason |

### US-4.02: Result Persistence — 3 points
**User story:** As a student, I want my quiz results to persist so that I can review them later.

| Task | Assignee |
|------|----------|
| Store attempts with userId, quizId, score, takenAt | Jason |
| Store per-question results with topic and correctness; retrieval APIs | Mia |

### US-4.03: Analytics — 5 points
**User story:** As a student, I want to see weak-topic analytics so that I can identify areas to improve.

| Task | Assignee |
|------|----------|
| Aggregate QuestionResult data to compute per-topic accuracy | Jason |
| Build analytics dashboard with weakest topics highlighted | Subhangi |

### US-4.04: Recommendation — 5 points
**User story:** As a student, I want a "review next" recommendation so that I know what to study next.

| Task | Assignee |
|------|----------|
| Rank topics by low accuracy and staleness | Angela |
| Suggest flashcards or quizzes; display recommendation on dashboard | Subhangi |

### US-4.05, US-4.06, US-4.07: XP System — 8 points combined
**User story:** As a student, I want to earn XP for completing quests, taking quizzes, and reviewing flashcards so that I can progress my virtual pet. *(US-4.05: 3 pts, US-4.06: 3 pts, US-4.07: 2 pts)*

| Task | Assignee |
|------|----------|
| Award XP on quest completion and quiz submission | Mia |
| Extend Sprint 3 flashcard XP logic; update Pet model accordingly | Aadithya |

### US-4.08: Streak Tracking — 3 points
**User story:** As a student, I want my daily study streak tracked so that I can stay consistent.

| Task | Assignee |
|------|----------|
| Track lastStudyDate; increment/reset streakCount; display streak in pet widget | Jason |

### US-4.09: Pet Evolution — 5 points
**User story:** As a student, I want my pet to evolve based on XP thresholds so that I can see visual progress.

| Task | Assignee |
|------|----------|
| Define XP thresholds and stages (egg hatchling → adult); update pet stage dynamically | Angela, Subhangi |

### US-4.10: Pet Widget — 3 points
**User story:** As a student, I want the pet widget to show live evolving state so that I can see real-time progress.

| Task | Assignee |
|------|----------|
| Display XP, level, stage, and streak; ensure real-time UI updates after any study activity | Aadithya, Subhangi |

**Planned core total: 37 story points**

## Added Sprint Scope (Polish & Finalization)
The following work supports usability, accessibility, and demo readiness. These items are required to ensure a smooth final presentation and production-quality experience.

| ID | Feature | Points | Scope |
|----|---------|--------|-------|
| US-4.11 | Responsive UI | 5 | Ensure layouts adapt across mobile, tablet, and desktop; improve touch targets and eliminate overflow issues. |
| US-4.12 | Empty & Error States | 3 | Add loading, empty, and error states across views with clear messaging. |
| US-4.13 | Accessibility | 5 | Keyboard navigation, ARIA labels, contrast improvements, screen reader compatibility. |
| US-4.14 | Bug Bash & Polish | 3 | Fix console errors, verify performance, clean UI interactions. |
| US-4.15 | Final Demo Preparation | 2 | Rehearse full happy path, prepare narrative, seed demo data, and fallback strategies. |

**Added-scope estimate: 18 story points**
**Combined recorded scope: 55 story points**

## Initial Scrum Board
| User Story | Tasks To Do | Tasks In Progress | Tasks Completed |
|------------|-------------|-------------------|-----------------|
| US-4.01 Quiz Taking | Quiz UI, answer selection, scoring | — | — |
| US-4.02 Result Persistence | DB schema, API endpoints | — | — |
| US-4.03 Analytics | Aggregation logic, dashboard UI | — | — |
| US-4.04 Recommendation | Ranking logic, UI integration | — | — |
| US-4.05-4.07 XP System | XP triggers and updates | — | — |
| US-4.08 Streak Tracking | Streak logic and persistence | — | — |
| US-4.09 Pet Evolution | XP thresholds and stages | — | — |
| US-4.10 Pet Widget | Live UI updates | — | — |
| US-4.11-4.15 Polish | Responsive UI, accessibility, testing | — | — |

*(Initial board: All core stories are To Do at sprint planning. Work will move to In Progress during early sprint development, with polish tasks prioritized toward the end.)*

## Burnup Plan
| Date | Jul 15 | Jul 16 | Jul 17 | Jul 18 | Jul 19 | Jul 20 | Jul 21 | Jul 22 |
|------|--------|--------|--------|--------|--------|--------|--------|--------|
| Ideal completed points | 0 | 7 | 14 | 21 | 28 | 36 | 45 | 55 |
| Actual completed points | 0 | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

## Definition of Done
- Functionality meets the relevant acceptance criteria.
- Generated flashcards and quizzes pass server-side validation before database persistence.
- Code is reviewed, tested as appropriate, and does not regress the core demo path.
- The Scrum board and burnup are updated at scrum meetings.
- Non-core scope is deferred when necessary to protect the core MVP.

## Scrum Schedule
| Milestone | Date |
|-----------|------|
| Sprint 4 starts | July 15, 2026 |
| TA meeting/plan check | July 18, 2026 |
| Sprint review and completion | July 22, 2026 |