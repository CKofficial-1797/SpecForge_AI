import { Router } from "express";
import { projectRouter } from "../modules/projects/project.routes.js";
import { requirementRouter } from "../modules/requirements/requirement.routes.js";

export const apiRouter = Router();
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "specforge-api" });
});
apiRouter.use("/projects", projectRouter);
apiRouter.use("/requirements", requirementRouter);
