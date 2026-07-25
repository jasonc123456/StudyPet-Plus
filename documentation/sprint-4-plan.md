# Sprint 4 Plan
**Product:** StudyPet-Plus | **Team:** StudyPet-Plus | **Sprint Period:** July 13–19, 2026 (Mon–Sun) | **Sprint Completion:** July 19, 2026 | **Rev:** 1.0 | **Rev Date:** July 13, 2026

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

**Acceptance criteria:**
1. A student can open a generated quiz and select one answer per question.
2. Submitting the quiz produces a score and a per-question correct/incorrect breakdown.
3. A submitted attempt cannot be silently re-scored or edited after submission.

| Task | Assignee | Estimate |
|------|----------|----------|
| Build quiz-taking UI with answer selection and submission handling | Jason | 5h |
| Implement scoring logic and persist QuizAttempt and QuestionResult records | Jason | 3h |
| **Story Total** |  | **8h** |

### US-4.02: Result Persistence — 3 points
**User story:** As a student, I want my quiz results to persist so that I can review them later.

**Acceptance criteria:**
1. Each attempt is stored with `userId`, `quizId`, `score`, and `takenAt`.
2. Each question result is stored with its topic and correctness.
3. A student can retrieve only their own past attempts through the results API.

| Task | Assignee | Estimate |
|------|----------|----------|
| Store attempts with `userId`, `quizId`, `score`, `takenAt` | Jason | 3h |
| Store per-question results with topic and correctness; build retrieval APIs | Mia | 2h |
| **Story Total** |  | **5h** |

### US-4.03: Analytics — 5 points
**User story:** As a student, I want to see weak-topic analytics so that I can identify areas to improve.

**Acceptance criteria:**
1. Per-topic accuracy is computed from stored question results across all attempts.
2. The analytics dashboard lists topics with accuracy and attempt counts.
3. The weakest topics are visually highlighted, and an empty state is shown before any attempt exists.

| Task | Assignee | Estimate |
|------|----------|----------|
| Aggregate QuestionResult data to compute per-topic accuracy | Jason | 4h |
| Build analytics dashboard with weakest topics highlighted | Subhangi | 3h |
| **Story Total** |  | **7h** |

### US-4.04: Recommendation — 5 points
**User story:** As a student, I want a "review next" recommendation so that I know what to study next.

**Acceptance criteria:**
1. Topics are ranked by low accuracy and how long ago they were last studied.
2. The recommendation names a specific topic and links to a flashcard set or quiz for it.
3. The recommendation is visible on the dashboard and refreshes after a new attempt.

| Task | Assignee | Estimate |
|------|----------|----------|
| Rank topics by low accuracy and staleness | Angela | 3h |
| Surface flashcard/quiz suggestion and display recommendation on dashboard | Subhangi | 4h |
| **Story Total** |  | **7h** |

### US-4.05, US-4.06, US-4.07: XP System — 8 points combined
**User story:** As a student, I want to earn XP for completing quests, taking quizzes, and reviewing flashcards so that I can progress my virtual pet. *(US-4.05: 3 pts, US-4.06: 3 pts, US-4.07: 2 pts)*

**Acceptance criteria:**
1. Completing a quest awards XP once per quest completion.
2. Submitting a quiz awards XP, and reviewing a flashcard set awards XP.
3. Awarded XP is persisted to the Pet model and is reflected in the pet widget without a manual refresh.

| Task | Assignee | Estimate |
|------|----------|----------|
| Award XP on quest completion | Mia | 4h |
| Award XP on quiz submission | Mia | 4h |
| Extend Sprint 3 flashcard XP logic and update the Pet model accordingly | Aadithya | 3h |
| **Story Total** |  | **11h** |

### US-4.08: Streak Tracking — 3 points
**User story:** As a student, I want my daily study streak tracked so that I can stay consistent.

**Acceptance criteria:**
1. Any study activity on a new day increments `streakCount` and updates `lastStudyDate`.
2. A missed day resets the streak to zero on the next activity.
3. The current streak is displayed in the pet widget.

| Task | Assignee | Estimate |
|------|----------|----------|
| Track `lastStudyDate`, increment/reset `streakCount`, and display streak in pet widget | Jason | 4h |
| **Story Total** |  | **4h** |

### US-4.09: Pet Evolution — 5 points
**User story:** As a student, I want my pet to evolve based on XP thresholds so that I can see visual progress.

**Acceptance criteria:**
1. XP thresholds define the egg → hatchling → adult stages.
2. Crossing a threshold updates the stored pet stage automatically.
3. Each stage renders a distinct pet visual.

| Task | Assignee | Estimate |
|------|----------|----------|
| Define XP thresholds and stages (egg → hatchling → adult) | Angela | 4h |
| Update pet stage dynamically and render stage artwork | Subhangi | 3h |
| **Story Total** |  | **7h** |

### US-4.10: Pet Widget — 3 points
**User story:** As a student, I want the pet widget to show live evolving state so that I can see real-time progress.

**Acceptance criteria:**
1. The widget displays current XP, level, stage, and streak.
2. Values update after any study activity without a full page reload.
3. The widget renders correctly on mobile and desktop breakpoints.

| Task | Assignee | Estimate |
|------|----------|----------|
| Display XP, level, stage, and streak in the widget | Aadithya | 3h |
| Ensure real-time UI updates after any study activity | Subhangi | 3h |
| **Story Total** |  | **6h** |

**Core committed total: 37 story points / 55h**

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
| Date | Jul 13 | Jul 14 | Jul 15 | Jul 16 | Jul 17 | Jul 18 | Jul 19 |
|------|--------|--------|--------|--------|--------|--------|--------|
| Ideal completed points | 0 | 9 | 18 | 27 | 36 | 46 | 55 |
| Actual completed points | 0 | TBD | TBD | TBD | TBD | TBD | TBD |

## Definition of Done
- Functionality meets the relevant acceptance criteria.
- Generated flashcards and quizzes pass server-side validation before database persistence.
- Code is reviewed, tested as appropriate, and does not regress the core demo path.
- The Scrum board and burnup are updated at scrum meetings.
- Non-core scope is deferred when necessary to protect the core MVP.

## Scrum Schedule
| Day | Date | Time | Type |
|-----|------|------|------|
| Monday | July 13, 2026 | 9:00–9:30 AM | Sprint Planning |
| Tuesday | July 14, 2026 | 9:00–9:30 AM | **TA visit** (weekly Tuesday check-in) |
| Wednesday | July 15, 2026 | 9:30–10:00 AM | Daily Scrum |
| Friday | July 17, 2026 | 9:00–9:30 AM | Daily Scrum |
| Friday | July 17, 2026 | 9:30–10:00 AM | **TA visit** (weekly Friday check-in) |
| Sunday | July 19, 2026 | 9:00–9:30 AM | Sprint Review / Final Demo + Retro |

*All scrum slots are 30 minutes. TA visits are scheduled every Tuesday at 9:00 AM and Friday at 9:30 AM for the duration of the course.*

### Key Milestones
| Milestone | Date |
|-----------|------|
| Sprint 4 starts | July 13, 2026 |
| **TA visit** — plan check | July 14, 2026 |
| **TA visit** — final progress check | July 17, 2026 |
| Sprint review and completion | July 19, 2026 |