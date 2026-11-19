ALTER TABLE "Project"
ADD CONSTRAINT "Project_name_nonempty_check"
CHECK (length(btrim("name")) > 0);

ALTER TABLE "Requirement"
ADD CONSTRAINT "Requirement_key_nonempty_check"
CHECK (length(btrim("requirementKey")) > 0),
ADD CONSTRAINT "Requirement_title_nonempty_check"
CHECK (length(btrim("title")) > 0),
ADD CONSTRAINT "Requirement_description_nonempty_check"
CHECK (length(btrim("description")) > 0),
ADD CONSTRAINT "Requirement_currentVersion_positive_check"
CHECK ("currentVersion" > 0);

ALTER TABLE "RequirementVersion"
ADD CONSTRAINT "RequirementVersion_number_positive_check"
CHECK ("versionNumber" > 0),
ADD CONSTRAINT "RequirementVersion_title_nonempty_check"
CHECK (length(btrim("title")) > 0),
ADD CONSTRAINT "RequirementVersion_description_nonempty_check"
CHECK (length(btrim("description")) > 0);
