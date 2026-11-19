import { Router } from "express";
import { projectRouter } from "../modules/projects/project.routes.js";
import { requirementRouter } from "../modules/requirements/requirement.routes.js";
import { aiRouter } from "../modules/ai/ai.routes.js";
import { clarificationRouter } from "../modules/clarifications/clarification.routes.js";
import { acceptanceRouter } from "../modules/acceptance-criteria/acceptance.routes.js";
import { refinementRouter } from "../modules/refinement/refinement.routes.js";
import { testCaseRouter } from "../modules/test-cases/test-cases.routes.js";
import {
  acceptanceTraceabilityRouter,
  testCaseTraceabilityRouter,
} from "../modules/traceability/traceability.routes.js";

export const apiRouter = Router();
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "specforge-api" });
});
apiRouter.use("/projects", projectRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/clarifications", clarificationRouter);
apiRouter.use("/acceptance-criteria", acceptanceRouter);
apiRouter.use("/acceptance-criteria", acceptanceTraceabilityRouter);
apiRouter.use("/refinement-drafts", refinementRouter);
apiRouter.use("/test-cases", testCaseRouter);
apiRouter.use("/test-cases", testCaseTraceabilityRouter);
apiRouter.use("/requirements", requirementRouter);
