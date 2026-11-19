CREATE TYPE "TestGenerationRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'UNAVAILABLE');
CREATE TYPE "TestType" AS ENUM ('POSITIVE', 'NEGATIVE', 'BOUNDARY', 'VALIDATION', 'FAILURE', 'AUTHORIZATION', 'RECOVERY');
CREATE TYPE "TestCasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "TestCaseStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'SUPERSEDED');

ALTER TABLE "AcceptanceCriterion" ADD CONSTRAINT "AcceptanceCriterion_id_requirementId_sourceRequirementVersion_key" UNIQUE ("id", "requirementId", "sourceRequirementVersion");

CREATE TABLE "TestGenerationRun" (
  "id" UUID NOT NULL,
  "requirementId" UUID NOT NULL,
  "sourceRequirementVersion" INTEGER NOT NULL,
  "sourceAcceptanceCriterionIds" JSONB NOT NULL,
  "limitations" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "modelName" VARCHAR(120),
  "promptVersion" VARCHAR(40) NOT NULL,
  "status" "TestGenerationRunStatus" NOT NULL DEFAULT 'PENDING',
  "errorCode" VARCHAR(80),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(3),
  "durationMs" INTEGER,
  CONSTRAINT "TestGenerationRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TestGenerationRun_id_requirementId_sourceRequirementVersion_key" UNIQUE ("id", "requirementId", "sourceRequirementVersion")
);
CREATE INDEX "TestGenerationRun_requirementId_sourceRequirementVersion_createdAt_idx" ON "TestGenerationRun"("requirementId", "sourceRequirementVersion", "createdAt");
CREATE INDEX "TestGenerationRun_status_createdAt_idx" ON "TestGenerationRun"("status", "createdAt");
ALTER TABLE "TestGenerationRun" ADD CONSTRAINT "TestGenerationRun_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestGenerationRun" ADD CONSTRAINT "TestGenerationRun_requirementId_sourceRequirementVersion_fkey" FOREIGN KEY ("requirementId", "sourceRequirementVersion") REFERENCES "RequirementVersion"("requirementId", "versionNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TestCase" (
  "id" UUID NOT NULL,
  "requirementId" UUID NOT NULL,
  "acceptanceCriterionId" UUID NOT NULL,
  "generationRunId" UUID NOT NULL,
  "sourceRequirementVersion" INTEGER NOT NULL,
  "revisionNumber" INTEGER NOT NULL DEFAULT 1,
  "fingerprint" CHAR(64) NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "testType" "TestType" NOT NULL,
  "preconditions" JSONB NOT NULL,
  "testSteps" JSONB NOT NULL,
  "testData" JSONB NOT NULL,
  "expectedResult" VARCHAR(2000) NOT NULL,
  "priority" "TestCasePriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "TestCaseStatus" NOT NULL DEFAULT 'DRAFT',
  "generationSource" VARCHAR(40) NOT NULL DEFAULT 'OLLAMA',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "reviewedAt" TIMESTAMPTZ(3),
  "reviewedBy" VARCHAR(120),
  CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TestCase_acceptanceCriterionId_fingerprint_key" UNIQUE ("acceptanceCriterionId", "fingerprint"),
  CONSTRAINT "TestCase_id_revisionNumber_key" UNIQUE ("id", "revisionNumber")
);
CREATE INDEX "TestCase_requirementId_sourceRequirementVersion_status_createdAt_idx" ON "TestCase"("requirementId", "sourceRequirementVersion", "status", "createdAt");
CREATE INDEX "TestCase_acceptanceCriterionId_status_idx" ON "TestCase"("acceptanceCriterionId", "status");
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_acceptanceCriterionId_requirementId_sourceRequirementVersion_fkey" FOREIGN KEY ("acceptanceCriterionId", "requirementId", "sourceRequirementVersion") REFERENCES "AcceptanceCriterion"("id", "requirementId", "sourceRequirementVersion") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_requirementId_sourceRequirementVersion_fkey" FOREIGN KEY ("requirementId", "sourceRequirementVersion") REFERENCES "RequirementVersion"("requirementId", "versionNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_generationRunId_requirementId_sourceRequirementVersion_fkey" FOREIGN KEY ("generationRunId", "requirementId", "sourceRequirementVersion") REFERENCES "TestGenerationRun"("id", "requirementId", "sourceRequirementVersion") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TestCaseRevision" (
  "id" UUID NOT NULL,
  "testCaseId" UUID NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestCaseRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TestCaseRevision_testCaseId_revisionNumber_key" UNIQUE ("testCaseId", "revisionNumber")
);
CREATE INDEX "TestCaseRevision_testCaseId_createdAt_idx" ON "TestCaseRevision"("testCaseId", "createdAt");
ALTER TABLE "TestCaseRevision" ADD CONSTRAINT "TestCaseRevision_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
