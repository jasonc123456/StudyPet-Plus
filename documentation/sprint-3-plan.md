# Sprint 3 Plan
**Product:** StudyPet-Plus | **Team:** StudyPet-Plus | **Sprint Period:** July 6–12, 2026 (Mon–Sun) | **Sprint Completion:** July 12, 2026 | **Rev:** 1.0 | **Rev Date:** July 6, 2026

## Sprint Goal
Students can paste course notes and explicitly generate validated, topic-tagged flashcards and multiple-choice quizzes that persist to the database. They can review flashcards with a flip and known/unknown flow, earning initial XP reflected in the pet widget.

## Team Capacity
- Team members: 5
- Planned available hours: 65h (5 members × 13h/sprint)
- Capacity buffer (15%): 10h
- Committed work hours: 55h

## Scope
- **Core committed scope:** 21 story points (US-3.1 through US-3.5)
- **Added scope recorded during the sprint:** 20 story points (US-3.6 through US-3.9)
- **Combined recorded scope:** 41 story points
- **MVP priority:** Complete the notes-to-validated-study-material path first. Park non-core work if it threatens the demo; back-fill tests, polish, and Definition-of-Done checks before review.

## Team Roles
| Member | Role |
|--------|------|
| Jason | Product Owner, Developer |
| Mia | Scrum Master, Developer |
| Angela | Developer |
| Subhangi | Developer |
| Aadithya | Developer |

## User Stories

### US-3.1: Notes Management — 3 points
**User story:** As a student, I want to paste, save, and manage notes for each course so that I can use my own materials to study.

**Acceptance criteria:**
1. A student can create and save notes associated with a course and their account.
2. A student can view, edit, and delete only their own notes.
3. Saved note content is available as input for generation.

| Task | Assignee | Estimate |
|------|----------|----------|
| Create notes data model scoped to course and user | Angela | 3h |
| Build paste/store and notes management UI | Angela | 3h |
| Implement create, view, edit, and delete actions | Angela | 2h |
| **Story Total** |  | **8h** |

### US-3.2: AI Provider Layer — 5 points
**User story:** As a student, I want reliable AI generation from my notes so that generated study material has a consistent, safe data shape.

**Acceptance criteria:**
1. Generation uses a Gemini-first provider with a DeepSeek fallback.
2. API keys are loaded from server-side environment variables.
3. Provider output is structured JSON and is validated server-side before persistence.
4. Provider failures, malformed output, and rate limits show a safe error rather than persisting invalid data.

| Task | Assignee | Estimate |
|------|----------|----------|
| Define `generateFlashcards` and `generateQuiz` provider interfaces | Jason | 3h |
| Implement Gemini provider and environment-key configuration | Jason | 4h |
| Implement DeepSeek fallback | Jason | 3h |
| Add JSON validation and error/rate-limit handling | Jason | 4h |
| **Story Total** |  | **14h** |

### US-3.3: Flashcard Generation — 5 points
**User story:** As a student, I want topic-tagged flashcards generated from notes so that I can study concepts in organized sets.

**Acceptance criteria:**
1. A student can explicitly request flashcard generation from saved notes.
2. Each accepted card includes a question, answer, and topic.
3. Validated generated cards persist to the database and can be retrieved for review.

| Task | Assignee | Estimate |
|------|----------|----------|
| Implement topic-tagged flashcard generation | Mia | 4h |
| Add question, answer, and topic fields | Mia | 2h |
| Persist validated flashcards to the database | Mia | 4h |
| **Story Total** |  | **10h** |

### US-3.4: Quiz Generation — 5 points
**User story:** As a student, I want a multiple-choice quiz generated from notes so that I can check my understanding.

**Acceptance criteria:**
1. A student can explicitly request quiz generation from saved notes.
2. Each question includes answer options, a valid `correctIndex`, and a topic.
3. Only validated quiz questions persist to the database.

| Task | Assignee | Estimate |
|------|----------|----------|
| Implement MCQ quiz generation | Aadithya | 5h |
| Store options, `correctIndex`, and topic | Aadithya | 3h |
| Persist validated generated quizzes | Aadithya | 4h |
| **Story Total** |  | **12h** |

### US-3.5: Flashcard Review and XP — 3 points
**User story:** As a student, I want to flip cards and mark them known or unknown so that I can actively review material and receive early XP feedback.

**Acceptance criteria:**
1. A student can flip a flashcard to reveal its answer.
2. A student can mark each reviewed card as known or unknown.
3. Completing a review awards initial XP and updates the pet-widget study activity.

| Task | Assignee | Estimate |
|------|----------|----------|
| Build flip-card UI | Aadithya | 4h |
| Add known/unknown controls | Aadithya | 3h |
| Award XP for completed reviews | Aadithya | 4h |
| **Story Total** |  | **11h** |

**Core committed total: 21 story points / 55h**

## Added Sprint Scope
The following items were added during Week 3 outside the original AI/planner backlog. They are recorded for transparency but are not higher priority than the core MVP.

| ID | Feature | Points | Scope | Initial Owner |
|----|---------|--------|-------|---------------|
| US-3.6 | Study Groups | 8 | Create/join groups; expiring/limited invite links; memberships, roles, channels, messages, and assigned group tasks | Subhangi |
| US-3.7 | Calendar Subscriptions | 5 | ICS subscriptions and parser; month/day views; group feeds; task checklist; fetch guards | Jason, Subhangi |
| US-3.8 | Pomodoro Timer | 2 | Dashboard focus-timer widget | Subhangi |
| US-3.9 | First-Run Onboarding | 5 | Name, browser-default timezone, avatar, and later Settings editing | Jason, Subhangi |
| **Added-scope total** |  | **20** |  |  |

## Initial Scrum Board
| User Story | To Do | In Progress | Completed |
|------------|-------|-------------|-----------|
| US-3.1 Notes Management | Notes model; paste/store UI; CRUD actions | — | — |
| US-3.2 AI Provider Layer | Interface; Gemini; DeepSeek fallback; JSON validation; errors/rate limits | — | — |
| US-3.3 Flashcard Generation | Generate cards; fields; persistence | — | — |
| US-3.4 Quiz Generation | Generate MCQs; fields; persistence | — | — |
| US-3.5 Flashcard Review & XP | Flip UI; known/unknown; XP | — | — |
| US-3.6 Study Groups | Invites/roles; channels/messages; tasks; authorization | — | — |
| US-3.7 Calendar Subscriptions | ICS/parser; calendar views; feeds; checklist; fetch guards | — | — |
| US-3.8 Pomodoro Timer | Dashboard timer widget | — | — |
| US-3.9 First-Run Onboarding | — | Name, timezone, avatar setup; Settings editing | — |

## Burnup Plan
| Date | Jul 6 | Jul 7 | Jul 8 | Jul 9 | Jul 10 | Jul 11 | Jul 12 |
|------|-------|-------|-------|-------|--------|--------|--------|
| Ideal completed points | 0 | 7 | 14 | 21 | 27 | 34 | 41 |
| Actual completed points | 0 | 7 | 14 | 21 | 27 | 34 | 41 |


## Definition of Done
- Functionality meets the relevant acceptance criteria.
- Generated flashcards and quizzes pass server-side validation before database persistence.
- Code is reviewed, tested as appropriate, and does not regress the core demo path.
- The Scrum board and burnup are updated at scrum meetings.
- Non-core scope is deferred when necessary to protect the core MVP.

## Scrum Schedule
| Milestone | Date | Time |
|-----------|------|------|
| Sprint 3 starts / Sprint Planning (Monday) | July 6, 2026 | 9:00–9:30 AM |
| **TA visit** — plan check (Tuesday) | July 7, 2026 | 9:00–9:30 AM |
| Daily Scrum (Wednesday) | July 8, 2026 | 9:30–10:00 AM |
| Daily Scrum (Friday) | July 10, 2026 | 9:00–9:30 AM |
| **TA visit** — progress check (Friday) | July 10, 2026 | 9:30–10:00 AM |
| Sprint review and completion (Sunday) | July 12, 2026 | 9:00–9:30 AM |

*All scrum slots are 30 minutes. TA visits are scheduled every Tuesday at 9:00 AM and Friday at 9:30 AM for the duration of the course.*

