// Role requirements + learning resources for the Skill Gap and Roadmap pages.
// Prototype data — no backend yet.

export type Requirement = {
  skill: string;
  importance: "core" | "helpful";
  why: string;
  resources: { label: string; kind: "course" | "project" | "practice" }[];
};

export const ROLE_REQUIREMENTS: Record<string, Requirement[]> = {
  default: [
    {
      skill: "Python",
      importance: "core",
      why: "Most entry-level backend and data work assumes you can write clean Python.",
      resources: [
        { label: "Python for Everybody", kind: "course" },
        { label: "Build a data-cleaning CLI", kind: "project" },
      ],
    },
    {
      skill: "SQL",
      importance: "core",
      why: "Almost every team expects you to query a database without help.",
      resources: [
        { label: "SQLBolt exercises", kind: "practice" },
        { label: "Design + query a small schema", kind: "project" },
      ],
    },
    {
      skill: "Git & GitHub",
      importance: "core",
      why: "Teams review work through pull requests — this is table stakes.",
      resources: [{ label: "Branch, review, merge a real repo", kind: "project" }],
    },
    {
      skill: "React",
      importance: "core",
      why: "Front-end and full-stack roles list it more than any other framework.",
      resources: [
        { label: "React foundations", kind: "course" },
        { label: "Ship a small dashboard", kind: "project" },
      ],
    },
    {
      skill: "TypeScript",
      importance: "helpful",
      why: "Turns a React portfolio from student-grade into team-ready.",
      resources: [{ label: "Convert a JS project to TS", kind: "project" }],
    },
    {
      skill: "Docker",
      importance: "helpful",
      why: "Shows you can run your project the same way a team would.",
      resources: [{ label: "Containerise one of your repos", kind: "project" }],
    },
    {
      skill: "System Design",
      importance: "helpful",
      why: "Comes up in interviews once you pass the coding round.",
      resources: [{ label: "Design a URL shortener", kind: "practice" }],
    },
    {
      skill: "AWS",
      importance: "helpful",
      why: "Deploying something publicly is a strong signal of ownership.",
      resources: [{ label: "Deploy a project to a cloud host", kind: "project" }],
    },
  ],
};

export function requirementsForRole(role?: string): Requirement[] {
  return ROLE_REQUIREMENTS[role?.toLowerCase() ?? ""] ?? ROLE_REQUIREMENTS.default;
}
