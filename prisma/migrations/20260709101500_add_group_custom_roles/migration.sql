-- CreateTable
CREATE TABLE "GroupCustomRole" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupCustomRole_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "GroupMembership" ADD COLUMN "customRoleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GroupCustomRole_groupId_name_key" ON "GroupCustomRole"("groupId", "name");

-- CreateIndex
CREATE INDEX "GroupCustomRole_groupId_idx" ON "GroupCustomRole"("groupId");

-- CreateIndex
CREATE INDEX "GroupMembership_customRoleId_idx" ON "GroupMembership"("customRoleId");

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "GroupCustomRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupCustomRole" ADD CONSTRAINT "GroupCustomRole_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
