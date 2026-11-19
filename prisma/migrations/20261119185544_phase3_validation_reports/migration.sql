-- CreateTable
CREATE TABLE "ValidationReport" (
    "id" UUID NOT NULL,
    "requirementId" UUID NOT NULL,
    "requirementVersion" INTEGER NOT NULL,
    "ruleSetVersion" VARCHAR(40) NOT NULL,
    "reportData" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ValidationReport_requirementId_requirementVersion_createdAt_idx" ON "ValidationReport"("requirementId", "requirementVersion", "createdAt");

-- CreateIndex
CREATE INDEX "ValidationReport_ruleSetVersion_createdAt_idx" ON "ValidationReport"("ruleSetVersion", "createdAt");

-- AddForeignKey
ALTER TABLE "ValidationReport" ADD CONSTRAINT "ValidationReport_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
