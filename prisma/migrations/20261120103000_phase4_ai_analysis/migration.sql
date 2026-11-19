CREATE TYPE "AiAnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'UNAVAILABLE');

CREATE TABLE "AiAnalysis" (
    "id" UUID NOT NULL,
    "requirementId" UUID NOT NULL,
    "requirementVersion" INTEGER NOT NULL,
    "modelName" VARCHAR(120),
    "promptVersion" VARCHAR(40) NOT NULL,
    "schemaVersion" VARCHAR(40) NOT NULL,
    "ruleSetVersion" VARCHAR(40),
    "status" "AiAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "outputData" JSONB,
    "contextVersions" JSONB NOT NULL,
    "errorCode" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "durationMs" INTEGER,
    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiAnalysis_requirementId_requirementVersion_createdAt_idx" ON "AiAnalysis"("requirementId", "requirementVersion", "createdAt");
CREATE INDEX "AiAnalysis_status_createdAt_idx" ON "AiAnalysis"("status", "createdAt");
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_requirementId_requirementVersion_fkey" FOREIGN KEY ("requirementId", "requirementVersion") REFERENCES "RequirementVersion"("requirementId", "versionNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
