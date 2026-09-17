import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillInventory } from "@/components/skill-inventory";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a href="/verify" {...props}>{children}</a>
  ),
}));

describe("SkillInventory", () => {
  it("renders an unverified skill and its verification action", () => {
    render(
      <SkillInventory
        skills={[{
          id: "react",
          name: "React",
          status: "needs-evidence",
          source: "manual",
          proficiency: 70,
          targetProficiency: 100,
          evidenceCount: 0,
        }]}
      />,
    );

    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Needs more evidence")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Verify this skill" })).toBeInTheDocument();
  });
});