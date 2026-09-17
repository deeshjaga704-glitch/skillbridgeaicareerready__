import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkillStatusBadge } from "@/components/skill-status-badge";

describe("SkillStatusBadge", () => {
  it("renders the needs-evidence status", () => {
    render(<SkillStatusBadge state="needs-evidence" />);

    expect(screen.getByText("Needs more evidence")).toBeInTheDocument();
  });
});