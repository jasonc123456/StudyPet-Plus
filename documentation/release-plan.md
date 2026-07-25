# Release Plan
**Product:** StudyPet AI Study Planner | **Team:** StudyPet-Plus | **Release:** v1.0 | **Release Date:** July 19, 2026 (end of Sprint 4) | **Rev:** 1.1 | **Rev Date:** July 21, 2026

## High-Level Goals
1. Students can manage courses, assignments, and study tasks in one planner-first web app.
2. Students can paste notes and generate flashcards/quizzes with AI.
3. Students can track weak topics and progress through a gamified StudyPet.

## User Stories

| ID   | User Story | Story Points | Priority | Sprint |
|------|------------|--------------|----------|--------|
| US-1 | As a user, I want to log in with a magic link so that I can securely access my dashboard. | 5 | High | 1 |
| US-2 | As a user, I want to log out so that my account stays secure when I'm done. | 3 | High | 1 |
| US-3 | As a user, I want a protected dashboard so that only logged-in users can see study data. | 5 | High | 1 |
| US-4 | As a user, I want a clean login page and navigation so that the app is easy to use.| 3 | Medium | 1 |
| US-5 | As a user, I want to manage my courses (create, edit, delete, view) so that my classes are organized. | 8 | High | 2 |
| US-6 | As a user, I want to add assignments with due dates and status so that I can track my schoolwork. | 5 | High | 2 |
| US-7 | As a user, I want to create study tasks/quests with XP rewards so that I stay motivated. | 5 | High | 2 |
| US-8 | As a user, I want a planner dashboard of upcoming assignments and study tasks so that I know what to work on next. | 8 | High | 2 |
| US-9 | As a user, I want to paste and store notes by course so that my study material is organized. | 5 | High | 3 |
| US-10 | As a user, I want to generate topic-tagged flashcards from my notes so that I can review efficiently. | 8 | High | 3 |
| US-11 | As a user, I want to generate multiple-choice quizzes from my notes so that I can test my understanding. | 8 | High | 3 |
| US-12 | As a user, I want generated flashcards and quizzes saved so that I can return to them later.| 5 | High | 3 |
| US-13 | As a user, I want to take quizzes, submit answers, and see scores so that I can measure my understanding. | 5 | High | 4 |
| US-14 | As a user, I want weak-topic analytics and review recommendations so that I know what to study next.| 8 | High | 4 |
| US-15 | As a user, I want XP, streaks, and pet evolution so that studying feels rewarding.| 8 | Medium | 4 |
| US-16 | As a user, I want a smooth, responsive, accessible experience so that the app feels ready for a final demo.| 5 | Medium | 4 |

**Total story points:** 96 | **Team velocity estimate:** 24 pts/sprint | **Sprints needed:** ~4 ✅

## Delivered Beyond This Plan

The following was added as recorded sprint scope after this plan was written and ships in v1.0. See the sprint 3 and 4 plans for the point estimates.

| ID | Feature | Sprint |
|----|---------|--------|
| US-3.6 | Study groups: memberships, custom roles, expiring invites, channels, messages, group tasks | 3 |
| US-3.7 | Calendar subscriptions: ICS feeds and parser, month/day views, group feeds, task checklist | 3 |
| US-3.8 | Pomodoro focus timer widget | 3 |
| US-3.9 | First-run onboarding: name, timezone, avatar | 3 |
| — | Grade tracker: grade profiles, grade scales, weighted categories, GPA | 3 |
| — | Course planners with AI/spreadsheet degree-plan import | 3 |
| US-4.S1 | MFA: authenticator-app TOTP and WebAuthn passkeys | 4 |
| US-4.S2 | Optional Google OAuth sign-in | 4 |

## Product Backlog (not in this release)
- US-17: Advanced analytics dashboard for long-term study trends, correlated with the grade tracker.
- US-18: Native mobile apps (iOS/Android).
- US-19: Shared flashcard decks and class-based leaderboards, building on the study groups shipped in Sprint 3.
- US-20: Instructor-facing tools for pushing assignments and recommended decks to enrolled students.
- US-4.S3: Full production email delivery for magic links.