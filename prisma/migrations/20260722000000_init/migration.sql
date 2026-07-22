-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('NORMAL', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "HolidayScope" AS ENUM ('NATIONWIDE', 'BANGKOK');

-- CreateEnum
CREATE TYPE "HolidayOrigin" AS ENUM ('MANUAL', 'OFFICIAL_SYNC');

-- CreateEnum
CREATE TYPE "HolidaySyncStatus" AS ENUM ('FRESH', 'CACHED', 'FAILED');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('ONE_TO_FIVE_MILLION', 'FIVE_TO_TEN_MILLION', 'TEN_TO_TWENTY_MILLION', 'ABOVE_TWENTY_MILLION', 'SELECTIVE_METHOD');

-- CreateEnum
CREATE TYPE "BidSubmissionTimeSlot" AS ENUM ('MORNING', 'AFTERNOON');

-- CreateTable
CREATE TABLE "Template" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateStep" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "workingDaysToNext" INTEGER NOT NULL,
    "bidSubmissionTimeSlot" "BidSubmissionTimeSlot",

    CONSTRAINT "TemplateStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL DEFAULT '',
    "budget" DECIMAL(15,2) NOT NULL,
    "budgetCategory" "BudgetCategory" NOT NULL,
    "startDate" DATE NOT NULL,
    "note" TEXT,
    "templateId" UUID NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "processEndDate" DATE NOT NULL,
    "isProcessEndManuallyAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "scheduleStatus" "ScheduleStatus" NOT NULL DEFAULT 'NORMAL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStep" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "workingDaysToNext" INTEGER NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "isDateManuallyAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "bidSubmissionTimeSlot" "BidSubmissionTimeSlot",

    CONSTRAINT "ProjectStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "sourceNote" TEXT NOT NULL,
    "scope" "HolidayScope" NOT NULL DEFAULT 'NATIONWIDE',
    "origin" "HolidayOrigin" NOT NULL DEFAULT 'MANUAL',
    "officialSourceUrl" TEXT,
    "officialSourceLabel" TEXT,
    "lastConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayCalendarYear" (
    "year" INTEGER NOT NULL,
    "isVerifiedComplete" BOOLEAN NOT NULL DEFAULT false,
    "sourceNote" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "lastSyncAttemptAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastSyncStatus" "HolidaySyncStatus",
    "lastSyncMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayCalendarYear_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "Template_key_key" ON "Template"("key");

-- CreateIndex
CREATE INDEX "TemplateStep_templateId_idx" ON "TemplateStep"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateStep_templateId_order_key" ON "TemplateStep"("templateId", "order");

-- CreateIndex
CREATE INDEX "Project_name_idx" ON "Project"("name");

-- CreateIndex
CREATE INDEX "Project_ownerName_idx" ON "Project"("ownerName");

-- CreateIndex
CREATE INDEX "Project_departmentName_idx" ON "Project"("departmentName");

-- CreateIndex
CREATE INDEX "Project_startDate_processEndDate_idx" ON "Project"("startDate", "processEndDate");

-- CreateIndex
CREATE INDEX "ProjectStep_projectId_idx" ON "ProjectStep"("projectId");

-- CreateIndex
CREATE INDEX "ProjectStep_scheduledDate_idx" ON "ProjectStep"("scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStep_projectId_order_key" ON "ProjectStep"("projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- AddForeignKey
ALTER TABLE "TemplateStep" ADD CONSTRAINT "TemplateStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStep" ADD CONSTRAINT "ProjectStep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
