-- Repair duplicates left behind by the old detach-on-disable behaviour.
--
-- Turning auto-sync off used to clear calendarSubscriptionId/externalUid on any
-- assignment the student had started or finished. Re-enabling it could no longer
-- recognise those rows, so the feed imported a second copy. The result is pairs
-- of rows with identical course + title + dueAt: one orphaned row holding the
-- student's real status, one freshly-imported "todo" row holding the feed link.
--
-- Rejoin them: move the feed link onto the row the student actually worked on,
-- then delete the untouched import. Nothing with a status other than 'todo' is
-- ever deleted here. The orphan is the survivor rather than the import because a
-- GradeItem may already point at it, and that FK is ON DELETE SET NULL.

-- No ON COMMIT DROP: this must also work if the runner is in autocommit, where
-- the table would vanish before the next statement. Dropped explicitly below.
CREATE TEMP TABLE _orphan_merge AS
WITH candidate AS (
  SELECT DISTINCT ON (imported.id)
    imported.id                          AS import_id,
    orphan.id                            AS keep_id,
    imported."calendarSubscriptionId"    AS subscription_id,
    imported."externalUid"               AS external_uid
  FROM "Assignment" imported
  JOIN "Assignment" orphan
    ON orphan."courseId" = imported."courseId"
   AND orphan.title = imported.title
   AND orphan."dueAt" IS NOT DISTINCT FROM imported."dueAt"
   AND orphan.id <> imported.id
   AND orphan."calendarSubscriptionId" IS NULL
   AND orphan."externalUid" IS NULL
   AND orphan.status <> 'todo'
  WHERE imported."calendarSubscriptionId" IS NOT NULL
    AND imported."externalUid" IS NOT NULL
    AND imported.status = 'todo'
  ORDER BY imported.id, orphan."createdAt" ASC
)
-- One import may only ever claim one orphan, and vice versa, or the unique index
-- on (calendarSubscriptionId, externalUid) would reject the update below.
SELECT DISTINCT ON (keep_id) import_id, keep_id, subscription_id, external_uid
FROM candidate
ORDER BY keep_id, import_id;

-- Delete before update: the unique index on (calendarSubscriptionId,
-- externalUid) is immediate, so the import must release the key first.
DELETE FROM "Assignment" a
USING _orphan_merge m
WHERE a.id = m.import_id;

UPDATE "Assignment" a
SET "calendarSubscriptionId" = m.subscription_id,
    "externalUid" = m.external_uid
FROM _orphan_merge m
WHERE a.id = m.keep_id;

DROP TABLE _orphan_merge;
