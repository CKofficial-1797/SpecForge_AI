-- DropForeignKey
ALTER TABLE "ValidationReport" DROP CONSTRAINT "ValidationReport_requirementId_fkey";

-- AddForeignKey
ALTER TABLE "ValidationReport" ADD CONSTRAINT "ValidationReport_requirementId_requirementVersion_fkey" FOREIGN KEY ("requirementId", "requirementVersion") REFERENCES "RequirementVersion"("requirementId", "versionNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
