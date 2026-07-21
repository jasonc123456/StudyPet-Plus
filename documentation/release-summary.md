# Release Summary
**Product:** StudyPet AI Study Planner  
**Team:** StudyPet-Plus  
**Date:** July 21, 2026  

---

## Key User Stories and Acceptance Criteria

### 1. Authentication and Access

- **User story:** As a user, I want to log in using a passwordless magic-link so that I can securely access my account without remembering a password.  
  - Acceptance criteria:
    - User can enter an email and receive a single-use magic link.
    - Clicking the magic link signs the user in and redirects to the dashboard.
    - Magic link expires after a short time or after one use.
    - Unauthenticated users cannot access the protected dashboard.
- **User story:** As a user, I want to log out easily so that my session remains secure when I am done using the app.  
  - Acceptance criteria:
    - A visible “Log out” control is available on the dashboard.
    - Clicking “Log out” ends the session and returns the user to the login page.

### 2. Planner and Task Management

- **User story:** As a user, I want to create, edit, delete, and view my courses so that I can organize my classes clearly.  
  - Acceptance criteria:
    - User can add a course with name and basic details.
    - User can edit and delete existing courses.
    - Course list updates immediately after changes and is visible on the dashboard.

- **User story:** As a user, I want to add assignments with due dates and status so that I can keep track of my schoolwork.  
  - Acceptance criteria:
    - User can create assignments linked to a course with title, due date, and status.
    - Assignments appear in the planner dashboard.
    - Updating assignment status is reflected in the UI.

- **User story:** As a user, I want to see upcoming assignments and study tasks in one dashboard, grouped by course and sorted by due date, so that I can quickly know what to work on next.  
  - Acceptance criteria:
    - Dashboard shows assignments and study tasks grouped by course.
    - Items are sorted by due date with upcoming items emphasized.

### 3. Notes, Flashcards, and Quizzes (AI Study Tools)

- **User story:** As a user, I want to paste and store notes by course so that I can keep study material organized.  
  - Acceptance criteria:
    - User can paste text notes and associate them with a course.
    - Notes are saved and can be viewed and edited later.

- **User story:** As a user, I want to generate topic-tagged flashcards from my notes so that I can review efficiently.  
  - Acceptance criteria:
    - Clicking “Generate flashcards” creates flashcards from selected notes.
    - Each flashcard has a question, answer, and topic tag.
    - Generated flashcards are saved and accessible in a flashcards view.

- **User story:** As a user, I want to generate multiple-choice quizzes from my notes so that I can test my understanding.  
  - Acceptance criteria:
    - Clicking “Generate quiz” produces multiple-choice questions based on the notes.
    - Each question has several options and a correct answer index.
    - Generated quizzes are saved and can be launched later.

### 4. Quiz Taking, Analytics, and Gamification

- **User story:** As a user, I want to take quizzes, submit answers, and receive scores so that I can measure my understanding.  
  - Acceptance criteria:
    - User can start a quiz, answer questions, and submit. 
    - After submission, the user sees a score and per-question correctness.

- **User story:** As a user, I want to see weak topics and review recommendations so that I know what to study next.  
  - Acceptance criteria:
    - Quiz results are aggregated by topic.
    - Topics with lower accuracy are marked as weak.
    - The system suggests specific flashcards or quizzes to review for weak topics.

- **User story:** As a user, I want to earn XP, maintain streaks, and evolve my StudyPet so that studying feels rewarding and consistent.  
  - Acceptance criteria:
    - Completing assignments, tasks, flashcards, or quizzes awards XP.
    - Daily or regular activity contributes to streaks.
    - Reaching XP thresholds triggers visible pet evolution stages.

---

## Known Problems

### Technical Issues

- AI-generated flashcards and quizzes can occasionally have formatting or content issues, requiring retries or manual cleanup.
- Edge cases around magic-link expiration and multiple rapid login requests may lead to confusing error states. 
- Performance may degrade when generating study content from very large notes.

### Missing Functionality

- Optional second-factor authentication (TOTP) and Google OAuth are not implemented in this release.
- Advanced analytics (long-term trends, GPA correlation, cohort insights) are not fully implemented; analytics focus on basic weak-topic feedback.
- Mood-based recommendations are simplified and may not cover all combinations of energy level, available time, difficulty, and deadlines.

### Design Shortcuts

- XP thresholds, streak rules, and pet evolution stages are partly hard coded rather than fully configurable.
- Recommendation logic for “what to study next” uses simple heuristics instead of a robust scoring model.
- Accessibility and mobile optimization are limited; some views may not be fully keyboard-accessible or polished on small screens.

---

## Product Backlog (Follow-On Project Guide)

### High-Priority User Stories

- Implement optional second-factor authentication (TOTP) and Google OAuth sign-in to strengthen security.
- Add an advanced analytics dashboard with visualizations and long-term tracking of weak topics and study progress.
- Improve mood-based recommendation logic to better combine energy level, available time, difficulty, and deadlines.
- Enhance accessibility and mobile responsiveness for all key flows (login, dashboard, notes, quizzes, StudyPet).
- Add social and collaborative features such as shared decks, group study rooms, and class-based leaderboards. 
- Provide instructor-facing tools for pushing assignments, study tasks, and recommended decks to enrolled students. 

### High-Priority Bug Fixes and Refactoring

- Harden AI error handling for timeouts, malformed responses, and retries. 
- Refine magic-link expiration, rate limiting, and error messages to make login failures clearer. 
- Refactor XP/streak/evolution logic to remove hard-coded values and move toward configuration-driven behavior. 
