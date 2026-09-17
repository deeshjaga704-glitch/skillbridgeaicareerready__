export type CandidateSkill = { name: string; level: "Foundational" | "Working" | "Proficient"; confidence: string; token?: string };

export type Candidate = {
  id: string;
  name: string;
  year: string;
  targetRole: string;
  readinessLow: number;
  readinessHigh: number;
  evidenceCount: number;
  verifiedSkills: CandidateSkill[];
  claimedSkills: string[];
  projects: { title: string; url: string; tests: string; proves: string[] }[];
  assessments: { dimension: string; score: number }[];
};

export const CANDIDATES: Candidate[] = [
  {
    id: "alex-rivera",
    name: "Alex Rivera",
    year: "Third year",
    targetRole: "Software Engineer",
    readinessLow: 68,
    readinessHigh: 79,
    evidenceCount: 9,
    verifiedSkills: [
      { name: "Python", level: "Working", confidence: "72–84%", token: "py-alex-001" },
      { name: "Git & GitHub", level: "Proficient", confidence: "80–92%", token: "git-alex-002" },
      { name: "Docker", level: "Working", confidence: "60–74%", token: "dk-alex-004" },
    ],
    claimedSkills: ["React", "TypeScript", "AWS"],
    projects: [
      { title: "Data-cleaning CLI", url: "https://github.com/example/data-cleaning-cli", tests: "24/24 passing", proves: ["Python"] },
      { title: "Containerised portfolio", url: "https://github.com/example/portfolio-docker", tests: "4/4 passing", proves: ["Docker", "Git & GitHub"] },
    ],
    assessments: [
      { dimension: "Correctness", score: 94 },
      { dimension: "Readability", score: 88 },
      { dimension: "Testing", score: 90 },
    ],
  },
  {
    id: "priya-nair",
    name: "Priya Nair",
    year: "Final year",
    targetRole: "Data Analyst",
    readinessLow: 74,
    readinessHigh: 85,
    evidenceCount: 12,
    verifiedSkills: [
      { name: "SQL", level: "Proficient", confidence: "82–93%" },
      { name: "Python", level: "Working", confidence: "68–80%" },
    ],
    claimedSkills: ["Tableau"],
    projects: [
      { title: "Hospital wait-time dashboard", url: "https://github.com/example/wait-times", tests: "18/18 passing", proves: ["SQL", "Python"] },
    ],
    assessments: [
      { dimension: "Query skill", score: 91 },
      { dimension: "Data modelling", score: 84 },
    ],
  },
  {
    id: "sam-oduya",
    name: "Sam Oduya",
    year: "Second year",
    targetRole: "Frontend Developer",
    readinessLow: 52,
    readinessHigh: 63,
    evidenceCount: 5,
    verifiedSkills: [{ name: "React", level: "Foundational", confidence: "55–67%" }],
    claimedSkills: ["TypeScript", "Figma"],
    projects: [
      { title: "Campus events app", url: "https://github.com/example/campus-events", tests: "9/12 passing", proves: ["React"] },
    ],
    assessments: [
      { dimension: "Component design", score: 71 },
      { dimension: "Accessibility", score: 58 },
    ],
  },
];

export function getCandidate(id: string) {
  return CANDIDATES.find((c) => c.id === id) ?? null;
}
