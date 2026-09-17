import { describe, expect, it } from "vitest";
import { buildSteps } from "@/lib/roadmap-generator";
import { progressFromSteps, withRoadmapInitializationLock } from "@/lib/supabase/roadmap";
import type { Skill } from "@/lib/skillbridge-store";

const skills: Skill[] = [
  { id: "python", name: "Python", status: "verified", source: "manual" },
  { id: "typescript", name: "TypeScript", status: "claimed", source: "manual" },
];

describe("roadmap generator", () => {
  it("preserves the generated thirteen-step order and stable IDs", () => {
    const steps = buildSteps(skills, "Unknown role");

    expect(steps).toHaveLength(13);
    expect(steps.map((step) => step.id)).toEqual([
      "profile",
      "connect",
      "core-Python",
      "core-SQL",
      "core-Git & GitHub",
      "core-React",
      "helpful-TypeScript",
      "helpful-Docker",
      "helpful-System Design",
      "helpful-AWS",
      "resume",
      "interview",
      "apply",
    ]);
  });

  it("is deterministic for the same skills and role and preserves auto completion", () => {
    const first = buildSteps(skills, "Unknown role");
    const second = buildSteps(skills, "Unknown role");

    expect(second).toEqual(first);
    expect(first.find((step) => step.id === "profile")?.auto).toBe(true);
    expect(first.find((step) => step.id === "core-Python")?.auto).toBe(true);
    expect(first.find((step) => step.id === "helpful-TypeScript")?.auto).toBe(false);
  });

  it("serializes initialization for one student and calculates persisted progress", async () => {
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      events.push("first-queued");
      releaseFirst = resolve;
    });

    const first = withRoadmapInitializationLock("student-1", async () => {
      events.push("first-started");
      await firstStarted;
      events.push("first-finished");
      return "first";
    });
    const second = withRoadmapInitializationLock("student-1", async () => {
      events.push("second-started");
      return "second";
    });

    await Promise.resolve();
    expect(events).toEqual(["first-queued", "first-started"]);
    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
    expect(events).toEqual(["first-queued", "first-started", "first-finished", "second-started"]);
    expect(progressFromSteps([{ progress_percentage: 100 }, { progress_percentage: 0 }, { progress_percentage: 100 }])).toBe(67);
  });
});
