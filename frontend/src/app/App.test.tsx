import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

describe("application shell", () => {
  it("shows SpecForge branding, tagline, and navigation", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: "SpecForge home" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "From Requirements to Reliable Software.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveClass(
      "active",
    );
  });
});
