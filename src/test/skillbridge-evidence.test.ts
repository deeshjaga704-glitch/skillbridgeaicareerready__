import { describe, expect, it } from "vitest";
import { skillMatchScore, skillState } from "@/lib/skillbridge-evidence";
import { mapAuthenticatedSkillProgress } from "@/lib/supabase/profile";
import type { Skill } from "@/lib/skillbridge-store";

const progressSkill: Skill = {
  id: "react",
  name: "React",
  status: "needs-evidence",
  source: "manual",
  proficiency: 70,
  targetProficiency: 100,
  evidenceCount: 0,
};

describe("skillState", () => {
  it("keeps an explicitly needs-evidence skill unverified", () => {
    expect(skillState(progressSkill)).toBe("needs-evidence");
  });

  it("decays old verified evidence into needs-evidence", () => {
    const oldVerification: Skill = {
      ...progressSkill,
      status: "verified",
      lastVerifiedAt: new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    expect(skillState(oldVerification)).toBe("needs-evidence");
  });

  it("maps a verified Supabase record to verified without trusting proficiency", () => {
    const [verified, unverified] = mapAuthenticatedSkillProgress([
      { skill_name: "React", category: "technical", proficiency: 70, target_proficiency: 100, evidence_count: 1, last_practiced_at: null },
      { skill_name: "TypeScript", category: "technical", proficiency: 60, target_proficiency: 100, evidence_count: 0, last_practiced_at: null },
    ], "student-1", [
      { skill_name: "React", outcome: "verified", timestamp: "2026-09-15T00:00:00.000Z" },
    ]);

    expect(verified).toMatchObject({ name: "React", status: "verified", source: "project", evidenceCount: 1 });
    expect(unverified).toMatchObject({ name: "TypeScript", status: "needs-evidence", source: "manual", evidenceCount: 0 });
  });
});

describe("skillMatchScore", () => {
  it("uses relevant proficiency as a partial role match", () => {
    expect(skillMatchScore(progressSkill, "React")).toBe(0.7);
  });

  it("does not turn unverified proficiency into verified status", () => {
    expect(skillMatchScore(progressSkill, "React")).toBeGreaterThan(0);
    expect(skillState(progressSkill)).not.toBe("verified");
  });
});