CREATE TYPE "ClarificationStatus" AS ENUM ('OPEN', 'ANSWERED', 'DISMISSED');
CREATE TYPE "RefinementDraftStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "AcceptanceCriterionStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'SUPERSEDED');

ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_id_requirementId_key" UNIQUE ("id", "requirementId");

CREATE TABLE "ClarificationQuestion" (
  "id" UUID NOT NULL,
  "requirementId" UUID NOT NULL,
  "sourceAnalysisId" UUID NOT NULL,
  "question" VARCHAR(500) NOT NULL,
  "reason" VARCHAR(800) NOT NULL,
  "relatedRequirementIds" JSONB NOT NULL,
  "questionFingerprint" CHAR(64) NOT NULL,
  "status" "ClarificationStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ClarificationQuestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClarificationQuestion_requirementId_sourceAnalysisId_questionFingerprint_key" UNIQUE ("requirementId", "sourceAnalysisId", "questionFingerprint")
);
CREATE INDEX "ClarificationQuestion_requirementId_status_createdAt_idx" ON "ClarificationQuestion"("requirementId", "status", "createdAt");
ALTER TABLE "ClarificationQuestion" ADD CONSTRAINT "ClarificationQuestion_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClarificationQuestion" ADD CONSTRAINT "ClarificationQuestion_sourceAnalysisId_requirementId_fkey" FOREIGN KEY ("sourceAnalysisId", "requirementId") REFERENCES "AiAnalysis"("id", "requirementId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ClarificationAnswer" (
  "id" UUID NOT NULL,
  "questionId" UUID NOT NULL,
  "answer" VARCHAR(5000) NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "answeredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClarificationAnswer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClarificationAnswer_questionId_revisionNumber_key" UNIQUE ("questionId", "revisionNumber")
);
CREATE INDEX "ClarificationAnswer_questionId_isCurrent_answeredAt_idx" ON "ClarificationAnswer"("questionId", "isCurrent", "answeredAt");
CREATE UNIQUE INDEX "ClarificationAnswer_one_current_idx" ON "ClarificationAnswer"("questionId") WHERE "isCurrent" = true;
ALTER TABLE "ClarificationAnswer" ADD CONSTRAINT "ClarificationAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ClarificationQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RefinementDraft" (
  "id" UUID NOT NULL,
  "requirementId" UUID NOT NULL,
  "baseRequirementVersion" INTEGER NOT NULL,
  "sourceAnalysisId" UUID NOT NULL,
  "proposedTitle" VARCHAR(180) NOT NULL,
  "proposedDescription" TEXT NOT NULL,
  "changeSummary" VARCHAR(1000) NOT NULL,
  "structuredOutput" JSONB NOT NULL,
  "promptVersion" VARCHAR(40) NOT NULL,
  "status" "RefinementDraftStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMPTZ(3),
  "reviewedBy" VARCHAR(120),
  CONSTRAINT "RefinementDraft_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RefinementDraft_requirementId_baseRequirementVersion_status_createdAt_idx" ON "RefinementDraft"("requirementId", "baseRequirementVersion", "status", "createdAt");
ALTER TABLE "RefinementDraft" ADD CONSTRAINT "RefinementDraft_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefinementDraft" ADD CONSTRAINT "RefinementDraft_requirementId_baseRequirementVersion_fkey" FOREIGN KEY ("requirementId", "baseRequirementVersion") REFERENCES "RequirementVersion"("requirementId", "versionNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefinementDraft" ADD CONSTRAINT "RefinementDraft_sourceAnalysisId_requirementId_fkey" FOREIGN KEY ("sourceAnalysisId", "requirementId") REFERENCES "AiAnalysis"("id", "requirementId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AcceptanceCriterion" (
  "id" UUID NOT NULL,
  "requirementId" UUID NOT NULL,
  "sourceRequirementVersion" INTEGER NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "given" VARCHAR(2000) NOT NULL,
  "when" VARCHAR(2000) NOT NULL,
  "then" VARCHAR(2000) NOT NULL,
  "isResolved" BOOLEAN NOT NULL DEFAULT true,
  "notes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "fingerprint" CHAR(64) NOT NULL,
  "generationSource" VARCHAR(40) NOT NULL DEFAULT 'OLLAMA',
  "modelName" VARCHAR(120),
  "promptVersion" VARCHAR(40) NOT NULL,
  "status" "AcceptanceCriterionStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "reviewedAt" TIMESTAMPTZ(3),
  "reviewedBy" VARCHAR(120),
  CONSTRAINT "AcceptanceCriterion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcceptanceCriterion_requirementId_sourceRequirementVersion_fingerprint_key" UNIQUE ("requirementId", "sourceRequirementVersion", "fingerprint")
);
CREATE INDEX "AcceptanceCriterion_requirementId_sourceRequirementVersion_status_createdAt_idx" ON "AcceptanceCriterion"("requirementId", "sourceRequirementVersion", "status", "createdAt");
ALTER TABLE "AcceptanceCriterion" ADD CONSTRAINT "AcceptanceCriterion_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcceptanceCriterion" ADD CONSTRAINT "AcceptanceCriterion_requirementId_sourceRequirementVersion_fkey" FOREIGN KEY ("requirementId", "sourceRequirementVersion") REFERENCES "RequirementVersion"("requirementId", "versionNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
