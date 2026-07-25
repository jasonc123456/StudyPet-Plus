# Sprint 4 Report
**Product:** StudyPet-Plus | **Team:** StudyPet-Plus | **Date:** July 19, 2026 | **Sprint Period:** July 13–19, 2026 (Mon–Sun)

## Retrospective: Start / Stop / Continue

### Stop Doing
| Action | Reason |
|--------|--------|
| Deferring UI polish and accessibility validation to the final days of the sprint | Responsive layouts, accessibility checks, and empty/error states require earlier validation to ensure a fully demo-ready experience. |
| Relying on feature-level completion without full end-to-end verification | Some features were functionally complete in isolation, but required additional integration testing across quiz-taking, analytics, XP updates, and pet state synchronization. |

### Start Doing
| Action | Reason |
|--------|--------|
| Incorporating end-to-end testing checkpoints throughout the sprint | Each major feature should include a complete user-flow validation to ensure seamless integration before the final demo. |
| Prioritizing demo-readiness alongside implementation | Preparing seed data, validating UI responsiveness, and rehearsing the user journey earlier reduces last-minute risk. |
| Tracking polish tasks (UI, accessibility, responsiveness) as first-class backlog items | Ensures they have clear acceptance criteria rather than treating them as optional final steps. |

### Keep Doing
| Action | Reason |
|--------|--------|
| Structuring development into clear backend models, API routes, and frontend components | This separation supports parallel development and scalability, as demonstrated by the success of the quiz and analytics logic. |
| Maintaining visible progress through the sprint board and linking features to concrete code artifacts | This continues to improve transparency and coordination across team members. |
| Focusing on delivering a complete user-centered workflow | The end-to-end study loop (quiz → analytics → recommendation → XP → pet progression) reflects strong alignment with product goals. |

## Sprint Outcomes

### Completed Stories
- US-4.01: Quiz taking flow with scoring and persistence (5 pts) ✅
- US-4.02: QuizAttempt and QuestionResult persistence (3 pts) ✅
- US-4.03: Weak-topic analytics aggregation (5 pts) ✅
- US-4.04: "Review next" recommendation system (5 pts) ✅
- US-4.05: XP rewards for quest completion (3 pts) ✅
- US-4.06: XP rewards for quiz completion (3 pts) ✅
- US-4.07: XP rewards for flashcard review (2 pts) ✅
- US-4.08: Daily streak tracking system (3 pts) ✅
- US-4.09: Pet evolution based on XP thresholds (5 pts) ✅
- US-4.10: Live pet widget displaying XP, stage, and streak (3 pts) ✅
- US-4.11: Responsive UI validation and refinement (5 pts) ✅ — responsive calendar grids plus shared `.btn-primary`/`.btn-secondary` classes carrying a 44px (`min-height: 2.75rem`) touch target, applied across 52 component files
- US-4.12: Empty and error state UX validation (3 pts) ✅ — dedicated empty-state components for tasks, quests, notes, and courses, plus a shared `errorResponse()` helper and error-state handling across the component tree
- US-4.13: Accessibility validation (ARIA, keyboard, contrast) (5 pts) ✅ — ARIA/role attributes across interactive components, global `:focus-visible` keyboard styling, and light/dark contrast fixes on the landing and auth surfaces
- US-4.14: Bug Bash & Polish (3 pts) ✅ — all known bugs resolved and UI interactions cleaned up as of the final presentation
- US-4.15: Final Demo Preparation (2 pts) ✅ — full happy path rehearsed, demo data seeded, and narrative completed ahead of the final presentation
- US-4.S1: MFA authentication — authenticator-app TOTP and WebAuthn passkey second factors (8 pts) ✅
- US-4.S2: Google OAuth login as an optional provider alongside the magic link (5 pts) ✅
- US-4.S3: Production email delivery via Office 365 SMTP (`nodemailer`, `EMAIL_SERVER_*` on port 587) (3 pts) ✅

### Incomplete Stories
- None. All 15 recorded-scope stories (US-4.01–US-4.15) were completed, plus 3 stretch stories (US-4.S1–US-4.S3). No stories were carried over or dropped from Sprint 4.

## Velocity

| Metric | Value |
|--------|-------|
| Stories completed | 18 |
| Story points completed (recorded scope) | 55/55 |
| Stretch points additionally delivered | 16 (US-4.S1, US-4.S2, US-4.S3) |
| Ideal work hours completed | 60 hours |
| Sprint days | 7 calendar days (July 13–19) |
| Stories/day | 2.57 |
| Ideal hours/day | 8.57 hours |
| Avg. stories/day (Sprints 2–4) | 1.82 |
| Avg. ideal hours/day (Sprints 2–4) | 7.61 hours |

*US-4.14 (Bug Bash & Polish) and US-4.15 (Final Demo Preparation) were carried out as continuous
work through the sprint. Both were completed ahead of the final presentation — all known bugs fixed
and the demo fully rehearsed — and are counted in the totals above.*

## Burnup Chart

![Sprint 4 Burnup Chart](./img/Sprint4_Burnup_Chart.png)

### Daily Burnup Data
| Sprint Day | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | Day 6 | Day 7 |
|------------|-------|-------|-------|-------|-------|-------|-------|
| Date | Jul 13 | Jul 14 | Jul 15 | Jul 16 | Jul 17 | Jul 18 | Jul 19 |
| Ideal completed points | 0 | 9 | 18 | 27 | 36 | 46 | 55 |
| Actual completed points | 0 | 7 | 16 | 27 | 38 | 47 | 55 |
| Ideal completed hours | 0 | 9 | 18 | 27 | 36 | 46 | 55 |
| Actual completed hours | 0 | 8 | 18 | 28 | 40 | 50 | 60 |

**Trend notes:** Actual progress tracked slightly behind the ideal line through Jul 14–15 while the
quiz-taking and persistence stories (US-4.01, US-4.02) were being integrated, then pulled ahead from
Jul 17 onward once the shared QuizAttempt/QuestionResult data layer unblocked analytics, XP, and pet
evolution work in parallel. The scope met the ideal line on Jul 16, was running ahead of it by the
Friday TA check-in on Jul 17, and finished on
plan at 55/55 points, with the extra 5 recorded hours accounted for by the three stretch stories
(US-4.S1–US-4.S3) delivered outside the committed scope.

### Summary
Sprint 4 successfully delivered all committed user stories, including quiz-taking, analytics, recommendations, and gamification through the StudyPet system, along with the responsiveness, empty/error-state, and accessibility validation stories (US-4.11–4.13). The application now supports a complete end-to-end study experience and is fully demo-ready. All three stretch goals landed as well — MFA (TOTP and passkeys), optional Google OAuth sign-in, and production email delivery over Office 365 SMTP. Bug Bash & Polish (US-4.14) and Final Demo Preparation (US-4.15) ran continuously through the sprint and were both completed ahead of the final presentation, with all known bugs resolved. Overall, the sprint met its primary objective of delivering a fully functional, demo-ready product with 100% of its recorded scope complete.