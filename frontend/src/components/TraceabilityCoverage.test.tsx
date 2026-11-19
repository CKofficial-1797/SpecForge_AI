import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { TraceabilityCoverage } from "./TraceabilityCoverage";
import * as traceApi from "../services/traceability";

describe("TraceabilityCoverage", () => {
  it("shows zero-denominator coverage, pending approvals, and actionable gaps", async () => {
    vi.spyOn(traceApi, "getTraceSummary").mockResolvedValue({
      projectId: "p1",
      counts: { staleArtifacts: 0 },
      coverage: {
        status: "NOT_APPLICABLE",
        eligibleCriteria: 0,
        coveredCriteria: 0,
        uncoveredCriteria: 0,
        percentage: null,
      },
      historicalCoverage: {
        status: "NOT_APPLICABLE",
        eligibleCriteria: 0,
        coveredCriteria: 0,
        uncoveredCriteria: 0,
        percentage: null,
      },
      pendingApprovals: {
        refinements: 0,
        acceptanceCriteria: 1,
        testCases: 2,
        total: 3,
      },
      approvedArtifacts: {
        refinements: 0,
        acceptanceCriteria: 0,
        testCases: 0,
        total: 0,
      },
      rejectedArtifacts: {
        refinements: 0,
        acceptanceCriteria: 0,
        testCases: 0,
        total: 0,
      },
    });
    vi.spyOn(traceApi, "getApprovalOverview").mockResolvedValue({
      projectId: "p1",
      pending: {
        refinementDrafts: 0,
        acceptanceCriteria: 1,
        testCases: 2,
        total: 3,
      },
      approved: {
        refinementDrafts: 0,
        acceptanceCriteria: 0,
        testCases: 0,
        total: 0,
      },
      rejected: {
        refinementDrafts: 0,
        acceptanceCriteria: 0,
        testCases: 0,
        total: 0,
      },
      stale: { refinementDrafts: 0, acceptanceCriteria: 0, testCases: 0 },
      items: {
        acceptanceCriteria: [
          {
            id: "a1",
            requirementId: "r1",
            requirementKey: "REQ-1",
            requirementTitle: "Access",
            title: "Active user",
          },
        ],
        testCases: [],
        refinementDrafts: [],
      },
    });
    vi.spyOn(traceApi, "getTraceability").mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    vi.spyOn(traceApi, "getTraceGaps").mockResolvedValue({
      data: [],
      requirements: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <TraceabilityCoverage projectId="p1" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      (await screen.findAllByText(/Not applicable · no approved criteria/))
        .length,
    ).toBe(2);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "REQ-1: Active user" }),
    ).toHaveAttribute("href", "/requirements/r1");
  });
});
