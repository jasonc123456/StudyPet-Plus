-- Calendar preference (Sprint 3, added mid-sprint): when true, the personal
-- calendar at /dashboard/calendar shows every dated task from the groups the
-- user belongs to, not only the ones assigned to them. Off by default.
ALTER TABLE "User" ADD COLUMN     "showAllGroupTasksOnCalendar" BOOLEAN NOT NULL DEFAULT false;
