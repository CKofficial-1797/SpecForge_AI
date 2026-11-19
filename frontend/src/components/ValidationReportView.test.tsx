import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectValidationSummary } from "./ProjectValidationSummary";
import { ValidationReportView } from "./ValidationReportView";
import type { ValidationReportRecord } from "../services/validation";

const report: ValidationReportRecord = {
  id: "report-1",
  requirementId: "req-1",
  requirementVersion: 2,
  ruleSetVersion: "1.0.0",
  createdAt: "2026-11-20T10:00:00.000Z",
  reportData: {
    requirementId: "req-1",
    requirementVersion: 2,
    analyzedAt: "2026-11-20T10:00:00.000Z",
    ruleSetVersion: "1.0.0",
    summary: {
      errors: 0,
      warnings: 1,
      informationalFindings: 0,
      passedRules: 4,
      rulesWithIssues: 1,
      skippedRules: 4,
    },
    ruleResults: [],
    findings: [
      {
        ruleId: "REQ_VAGUE_TERMS",
        category: "CLARITY",
        severity: "WARNING",
        title: "Vague term: quickly",
        description: "Quickly has no measurable definition.",
        evidence: "Found quickly in the description.",
        recommendation: "Specify a measurable response target.",
        affectedField: "description",
      },
    ],
    suggestedNextActions: ["Specify a measurable response target."],
  },
};

describe("validation report UI", () => {
  it("shows severity text, evidence, recommendation, and counts without a score", () => {
    render(<ValidationReportView record={report} />);
    expect(screen.getByText("WARNING")).toBeInTheDocument();
    expect(screen.getByText(/Found quickly/)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Specify a measurable response target/),
    ).toHaveLength(2);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(
      screen.queryByText(/quality score|percentage/i),
    ).not.toBeInTheDocument();
  });

  it("shows a truthful empty result and current project counters", () => {
    render(
      <>
        <ValidationReportView
          record={{
            ...report,
            reportData: {
              ...report.reportData,
              findings: [],
              suggestedNextActions: [],
            },
          }}
        />
        <ProjectValidationSummary
          summary={{
            projectId: "project-1",
            requirementsTotal: 4,
            requirementsAnalyzed: 2,
            requirementsWithErrors: 1,
            requirementsWithWarnings: 1,
            requirementsWithoutFindings: 0,
            requirementsNotAnalyzed: 2,
          }}
        />
      </>,
    );
    expect(screen.getByText(/No findings were produced/)).toBeInTheDocument();
    expect(screen.getByText("2 / 4 analyzed")).toBeInTheDocument();
    expect(screen.getByText("Requirements with errors")).toBeInTheDocument();
    expect(screen.getByText("Not analyzed")).toBeInTheDocument();
  });
});
