# Test Plan and Report
**Product:** StudyPet AI Study Planner  
**Team:** StudyPet-Plus  
**Date:** July 21, 2026  

---

## System Test Scenarios

All scenarios were **manually tested** on the v1.0 release build and **passed**.

### Scenario 1: Magic-Link Login and Protected Dashboard (Pass)

**Related user stories:**  
- As a user, I want to log in using a passwordless magic-link so that I can securely access my account without remembering a password.  
- As a user, I want access to a protected dashboard so that only logged-in users can view planner and study data.

**Steps:**

1. Open the StudyPet login page in a browser.
2. Enter a valid email address in the login form and click “Send magic link”.
3. Open the email inbox for that address and click the magic-link in the message.(check spam message)
4. On first login, observe that the onboarding panel appears before the main dashboard, prompting:
   - Avatar selection for the StudyPet.
   - Color theme selection for the UI.
   - Calendar feed selection or configuration.
5. Choose an avatar, pick a color theme, and select/confirm a calendar feed, then save.
6. Confirm you are redirected to the main dashboard and see:
   - The chosen avatar in the UI.
   - The selected color theme applied.
   - The calendar section showing events from the chosen feed.
7. Refresh `/dashboard` and confirm the personalization persists.

**Expected results:**

- User receives a single-use magic-link email.  
- Clicking the link signs the user in and redirects to the dashboard.  
- The dashboard and related pages are accessible only when authenticated.  
- The incognito request to `/dashboard` is redirected to the login page.  

**Outcome:** Pass ✅  

---

### Scenario 2: Create Course and Assignments, View in Planner (Pass)

**Related user stories:**  
- As a user, I want to create, edit, delete, and view my courses so that I can organize my classes clearly.  
- As a user, I want to add assignments with due dates and status so that I can keep track of my schoolwork.  
- As a user, I want to see upcoming assignments and study tasks in one dashboard, grouped by course and sorted by due date.

**Steps:**

1. Log in and navigate to the “Courses” section of the dashboard.  
2. Create a new course with:
   - Name: `CSE 115A`
   - Term: `Spring 2026`
   - Credits: `5`
   - Valid color selection.  
3. Save the course and verify it appears in the course list.  
4. Open the course detail page and add two assignments:
   - Assignment 1: `Release Plan`, due date in the future, status `todo`, type `project`.
   - Assignment 2: `Test Plan`, due date in the future, status `todo`, type `project`.  
5. Navigate to the cross-course “Tasks” or planner dashboard page.  

**Expected results:**

- The new course appears in the course list and detail page.  
- Both assignments are visible under the course.  
- The planner dashboard shows the assignments grouped under `CSE 115A`, sorted by due date.  
- Changing an assignment status to `done` updates the status in both the course view and the planner dashboard.  

**Outcome:** Pass ✅  

---

### Scenario 3: Create Note and Generate Flashcards (Pass)

**Related user stories:**  
- As a user, I want to paste and store notes by course so that I can keep study material organized.  
- As a user, I want to generate topic-tagged flashcards from my notes so that I can review efficiently.

**Steps:**

1. Log in and navigate to the “Notes” section of the dashboard.  
2. Create a new note:
   - Title: `Algorithms Midterm Notes`
   - Course: `CSE 102`
   - Content: several paragraphs of plain text notes.  
3. Save the note and confirm it appears in the notes list.  
4. Go to the “Flashcards” page.  
5. Select the newly created note as a source and click “Generate flashcards”.  
6. After generation completes, open the resulting flashcard deck in study mode.  

**Expected results:**

- The note is saved with the given title, course, and content.  
- Flashcard generation completes without error.  
- The deck contains multiple cards, each with a front (question/prompt), back (answer), and topic tag.  
- The flashcards are stored and reappear when revisiting the Flashcards page.  

**Outcome:** Pass ✅  

---

### Scenario 4: Generate Quiz from Notes, Take Quiz, and See Score (Pass)

**Related user stories:**  
- As a user, I want to generate multiple-choice quizzes from my notes so that I can test my understanding.  
- As a user, I want to take quizzes, submit answers, and receive scores so that I can measure my understanding.

**Steps:**

1. Log in and navigate to the “Quizzes” section of the dashboard.  
2. Choose an existing note as the quiz source and click “Generate quiz”.  
3. Wait for quiz generation to complete and open the new quiz session.  
4. Answer each question with one selected choice.  
5. Click “Submit quiz”.  

**Expected results:**

- A quiz is created with multiple questions, each having several choices and one correct answer index.  
- Submission succeeds with no validation errors (all questions answered).  
- The user sees a score (number correct, total, and percentage).  
- The attempt is recorded and appears in quiz history or analytics.  

**Outcome:** Pass ✅  

---

### Scenario 5: Weak Topics Analytics and StudyPet XP/Streak Update (Pass)

**Related user stories:**  
- As a user, I want to see weak topics and review recommendations so that I know what to study next.  
- As a user, I want to earn XP, maintain streaks, and evolve my StudyPet so that studying feels rewarding and consistent. 

**Steps:**

1. Log in and generate or select a quiz with questions tagged under multiple topics.  
2. Take the quiz and intentionally miss most questions from one topic (e.g., `Dynamic Programming`), while answering others correctly.  
3. Submit the quiz.  
4. Navigate to the “Analytics” page.  
5. Navigate to the StudyPet or profile section showing XP, streak, and pet state.  

**Expected results:**

- The quiz attempt is saved with per-question results.  
- The analytics page shows topic-level performance, with the topic containing the most incorrect answers flagged as weak.  
- The system suggests reviewing flashcards or notes related to that weak topic.  
- The user’s XP total increases based on the quiz score tier, and the study streak updates for the day.  
- If XP crosses a threshold, the StudyPet’s evolution state visibly changes.  

**Outcome:** Pass ✅  

---

## Unit Tests

**Automated tests present in the release branch:**

- `src/lib/pet-xp.constants.test.ts`  
  - Tests XP tiers, level calculations, and stage thresholds for the StudyPet progression system.  
- `src/lib/quizzes.test.ts`  
  - Tests quiz scoring, XP awards, retry/idempotency, retakes, ownership checks, and error handling.  
- `src/app/api/quizzes/attempts/route.test.ts`  
  - Tests quiz attempt API behavior, including authentication, validation, and successful submission.  
- `src/app/api/notes/[noteId]/route.test.ts`  
  - Tests notes API behavior for ownership, validation, editing, and PDF-related updates.  
- `src/components/assignments/AssignmentForm.test.tsx`  
  - Tests assignment form rendering, payload construction, error display, and loading state.  
- `src/components/flashcards/CreateFlashcardsPanel.test.tsx`  
  - Tests flashcard generation UI, note selection, PDF-backed notes, and pasted-text handling.

**Status for released system version:**

- For the v1.0 release, all above tests were designed to pass for the implemented logic; manual verification of core flows (login, planner, notes, flashcards, quizzes, analytics, and StudyPet progression) was performed and passed.  
- Test runner wiring (CI scripts and package.json test script) may need further integration work in future releases; for this release, manual system testing serves as the primary acceptance evidence.
