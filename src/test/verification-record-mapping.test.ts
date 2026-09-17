import { describe, expect, it } from "vitest";
import { fromVerificationRecordRow, toVerificationRecordRow } from "@/lib/supabase/profile";
import type { VerificationRecord } from "@/lib/skillbridge-store";

describe("toVerificationRecordRow", () => {
  it("maps the existing verification record without changing its identity or outcome", () => {
    const record: VerificationRecord = {
      id: "record-1",
      token: "react-token",
      skillId: "skill-1",
      skillName: "React",
      evidenceUrl: "https://github.com/example/react-project",
      studentName: "Arjun",
      method: "github-repo",
      evidenceSummary: "example/react-project - 12 commits, 8 files",
      outcome: "partial",
      signals: [],
      timestamp: "2026-09-10T12:00:00.000Z",
      reason: "Some evidence was found.",
      analysis: {
        source: "github",
        overall: 64,
        dimensions: [],
        facts: {},
        warnings: [],
      },
    };

    expect(toVerificationRecordRow(record, "student-1")).toEqual({
      id: "record-1",
      student_id: "student-1",
      skill_name: "React",
      token: "react-token",
      method: "github-repo",
      outcome: "partial",
      evidence_summary: "example/react-project - 12 commits, 8 files",
      evidence_url: "https://github.com/example/react-project",
      reason: "Some evidence was found.",
      timestamp: "2026-09-10T12:00:00.000Z",
      signals: [],
      analysis: record.analysis,
    });
  });
});

describe("fromVerificationRecordRow", () => {
  it("maps an owned Supabase row into the existing record shape", () => {
    const record = fromVerificationRecordRow({
      id: "record-1",
      student_id: "student-1",
      skill_name: "React",
      token: "react-token",
      method: "github-repo",
      outcome: "verified",
      evidence_summary: "Repository evidence",
      evidence_url: null,
      reason: "Evidence passed",
      timestamp: "2026-09-10T12:00:00.000Z",
      signals: [],
      analysis: null,
    }, "Arjun");

    expect(record).toEqual({
      id: "record-1",
      token: "react-token",
      skillId: "student-1:React",
      skillName: "React",
      studentName: "Arjun",
      method: "github-repo",
      evidenceSummary: "Repository evidence",
      outcome: "verified",
      signals: [],
      timestamp: "2026-09-10T12:00:00.000Z",
      reason: "Evidence passed",
    });
  });
});