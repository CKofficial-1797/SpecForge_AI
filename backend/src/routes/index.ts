import { Router } from "express";
import { projectRouter } from "../modules/projects/project.routes.js";
import { requirementRouter } from "../modules/requirements/requirement.routes.js";
import { aiRouter } from "../modules/ai/ai.routes.js";

export const apiRouter = Router();
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "specforge-api" });
});
apiRouter.use("/projects", projectRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/requirements", requirementRouter);
