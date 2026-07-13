CREATE TYPE "BidSubmissionTimeSlot" AS ENUM ('MORNING', 'AFTERNOON');

ALTER TABLE "TemplateStep"
ADD COLUMN "bidSubmissionTimeSlot" "BidSubmissionTimeSlot";

ALTER TABLE "ProjectStep"
ADD COLUMN "bidSubmissionTimeSlot" "BidSubmissionTimeSlot";
