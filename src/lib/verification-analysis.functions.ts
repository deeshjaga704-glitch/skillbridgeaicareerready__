import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Real verification analysis.
 *
 * For a public GitHub repository we fetch the actual repository, its commit
 * history, its file tree, its README and its CI run results, then run
 * deterministic checks (tests, documentation, quality, relevance, originality)
 * over that real data. An AI code review adds a qualitative read of sampled
 * source files. Nothing here is fabricated — every number comes from the repo.
 */

const Input = z.object({
  skillName: z.string().min(1).max(80),
  method: z.string().min(1).max(40),
  evidenceUrl: z.string().max(400).optional(),
  notes: z.string().max(4000).optional(),
});

export type CheckOutcome = "pass" | "warn" | "fail";

export type AnalysisCheck = {
  id: string;
  label: string;
  outcome: CheckOutcome;
  /** 0..1 */
  strength: number;
  detail: string;
  /** Raw facts the check was computed from. */
  facts: string[];
};

export type AnalysisDimension = { dimension: string; score: number; note: string };

export type VerificationAnalysis = {
  analysedAt: string;
  source: "github" | "text";
  repo?: {
    fullName: string;
    url: string;
    defaultBranch: string;
    isFork: boolean;
    language: string | null;
    files: number;
    commits: number;
    firstCommit?: string;
    lastCommit?: string;
    testFiles: string[];
    ciWorkflows: string[];
    latestCiConclusion?: string;
    readmeBytes: number;
  };
  checks: AnalysisCheck[];
  dimensions: AnalysisDimension[];
  overall: number; // 0..100
  outcome: "verified" | "partial" | "not_verified";
  reason: string;
  warnings: string[];
};

/* ------------------------------- GitHub I/O ------------------------------- */

const GH = "https://api.github.com";

function ghHeaders() {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "SkillBridge-AI-Verification",
  };
  const token = process.env["GITHUB_TOKEN"];
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function gh<T>(path: string): Promise<T | null> {
  const res = await fetch(`${GH}${path}`, { headers: ghHeaders() });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function b64ToText(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function parseRepo(url: string): { owner: string; repo: string } | null {
  const m = url.trim().match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i);
  if (!m) return null;
  return { owner: m[1]!, repo: m[2]!.replace(/\.git$/, "") };
}

/* ------------------------------ File heuristics ---------------------------- */

const TEST_RE = /(^|\/)(tests?|spec|__tests__)\//i;
const TEST_FILE_RE = /(test_[^/]+\.py|[^/]+_test\.(py|go|rb)|[^/]+\.(test|spec)\.(t|j)sx?|[^/]+Test\.java)$/i;
const CODE_EXT = /\.(py|ts|tsx|js|jsx|go|rb|java|rs|c|cc|cpp|cs|php|kt|swift|sql|sh)$/i;
const DOC_FILES = /(^|\/)(readme|docs?\/|contributing|architecture|api)/i;
const LINT_FILES =
  /(^|\/)(\.eslintrc|eslint\.config|\.flake8|ruff\.toml|pyproject\.toml|\.prettierrc|tsconfig\.json|\.editorconfig|Makefile)/i;

const SKILL_HINTS: Record<string, RegExp> = {
  python: /\.py$|requirements\.txt|pyproject\.toml/i,
  sql: /\.sql$|migrations?\//i,
  docker: /dockerfile|docker-compose/i,
  "git & github": /\.github\//i,
  react: /\.(jsx|tsx)$|package\.json/i,
  typescript: /\.tsx?$|tsconfig\.json/i,
  javascript: /\.(js|jsx|mjs)$/i,
  go: /\.go$|go\.mod/i,
  java: /\.java$|pom\.xml|build\.gradle/i,
  aws: /(cloudformation|serverless\.yml|terraform|\.tf$)/i,
};

function outcomeFor(strength: number): CheckOutcome {
  return strength >= 0.7 ? "pass" : strength >= 0.4 ? "warn" : "fail";
}

/* --------------------------------- AI review -------------------------------- */

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dimensions", "summary"],
  properties: {
    dimensions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dimension", "score", "note"],
        properties: {
          dimension: { type: "string", enum: ["Correctness", "Readability", "Testing", "Originality"] },
          score: { type: "integer" },
          note: { type: "string" },
        },
      },
    },
    summary: { type: "string" },
  },
};

async function aiReview(
  apiKey: string,
  skillName: string,
  context: string,
): Promise<{ dimensions: AnalysisDimension[]; summary: string } | null> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "google/gemini-3.7-flash",
      messages: [
        {
          role: "system",
          content:
            `You are a strict but fair code reviewer assessing whether a student can be said to have working ability in "${skillName}".` +
            ` Score four dimensions 0-100 based ONLY on the evidence given. Be conservative: tutorial-shaped or boilerplate code scores low on Originality;` +
            ` no tests means Testing scores below 40. Each note is one short plain-language sentence citing something concrete from the evidence.`,
        },
        { role: "user", content: context.slice(0, 60000) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "code_review", strict: true, schema: REVIEW_SCHEMA },
      },
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  try {
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as {
      dimensions?: AnalysisDimension[];
      summary?: string;
    };
    return {
      dimensions: (parsed.dimensions ?? []).map((d) => ({
        ...d,
        score: Math.max(0, Math.min(100, Math.round(d.score))),
      })),
      summary: parsed.summary ?? "",
    };
  } catch {
    return null;
  }
}

/* --------------------------------- Handler ---------------------------------- */

export const analyzeEvidence = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<VerificationAnalysis> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    const warnings: string[] = [];
    const checks: AnalysisCheck[] = [];
    const skillKey = data.skillName.toLowerCase();
    const target = data.evidenceUrl ? parseRepo(data.evidenceUrl) : null;

    if (!target) {
      // No repository to inspect — be honest about what could and could not be checked.
      const notes = (data.notes ?? "").trim();
      let dimensions: AnalysisDimension[] = [];
      let summary = "";
      if (apiKey && notes.length > 40) {
        const r = await aiReview(apiKey, data.skillName, `Evidence description supplied by the student:\n${notes}`);
        if (r) {
          dimensions = r.dimensions;
          summary = r.summary;
        }
      }
      checks.push({
        id: "evidence_source",
        label: "Inspectable evidence",
        outcome: "fail",
        strength: 0.1,
        detail: "No public repository was supplied, so no code, tests or documentation could be inspected.",
        facts: [data.evidenceUrl ? `Link provided: ${data.evidenceUrl}` : "No link provided"],
      });
      return {
        analysedAt: new Date().toISOString(),
        source: "text",
        checks,
        dimensions,
        overall: 0,
        outcome: "not_verified",
        reason:
          summary ||
          "We could not inspect any code. Link a public GitHub repository so tests, documentation and code quality can actually be checked.",
        warnings: ["Nothing was executed or read — this evidence stays a claim."],
      };
    }

    const { owner, repo } = target;
    const meta = await gh<{
      full_name: string;
      html_url: string;
      default_branch: string;
      fork: boolean;
      language: string | null;
      pushed_at: string;
    }>(`/repos/${owner}/${repo}`);

    if (!meta) {
      throw new Error(
        `We couldn't read github.com/${owner}/${repo}. Check the link and make sure the repository is public.`,
      );
    }

    const [commitsRaw, treeRaw, readmeRaw, runsRaw] = await Promise.all([
      gh<{ commit: { author: { date: string }; message: string } }[]>(
        `/repos/${owner}/${repo}/commits?per_page=100`,
      ),
      gh<{ tree: { path: string; type: string; size?: number }[]; truncated: boolean }>(
        `/repos/${owner}/${repo}/git/trees/${meta.default_branch}?recursive=1`,
      ),
      gh<{ content: string; encoding: string; size: number }>(`/repos/${owner}/${repo}/readme`),
      gh<{ workflow_runs: { name: string; conclusion: string | null; created_at: string }[] }>(
        `/repos/${owner}/${repo}/actions/runs?per_page=10`,
      ),
    ]);

    const commits = commitsRaw ?? [];
    const files = (treeRaw?.tree ?? []).filter((t) => t.type === "blob");
    const paths = files.map((f) => f.path);
    const readme = readmeRaw?.content ? b64ToText(readmeRaw.content).slice(0, 20000) : "";

    const testFiles = paths.filter((p) => TEST_RE.test(p) || TEST_FILE_RE.test(p));
    const ciWorkflows = paths.filter((p) => /^\.github\/workflows\/.+\.ya?ml$/i.test(p));
    const codeFiles = paths.filter((p) => CODE_EXT.test(p));
    const docFiles = paths.filter((p) => DOC_FILES.test(p));
    const lintFiles = paths.filter((p) => LINT_FILES.test(p));
    const runs = runsRaw?.workflow_runs ?? [];
    const latestRun = runs.find((r) => r.conclusion);

    const dates = commits.map((c) => new Date(c.commit.author.date).getTime()).filter(Boolean).sort();
    const firstCommit = dates.length ? new Date(dates[0]!).toISOString() : undefined;
    const lastCommit = dates.length ? new Date(dates[dates.length - 1]!).toISOString() : undefined;
    const spanDays = dates.length > 1 ? Math.round((dates[dates.length - 1]! - dates[0]!) / 864e5) : 0;
    const activeDays = new Set(commits.map((c) => c.commit.author.date.slice(0, 10))).size;

    /* --- Check 1: tests --- */
    {
      const ratio = codeFiles.length ? testFiles.length / codeFiles.length : 0;
      let strength = Math.min(0.8, testFiles.length ? 0.35 + ratio * 2 : 0);
      const facts = [
        `${testFiles.length} test file(s) found among ${codeFiles.length} source file(s)`,
        ciWorkflows.length ? `${ciWorkflows.length} CI workflow(s)` : "No CI workflow",
      ];
      if (latestRun) {
        facts.push(`Latest CI run "${latestRun.name}" concluded: ${latestRun.conclusion}`);
        strength = latestRun.conclusion === "success" ? Math.min(1, strength + 0.35) : Math.max(0, strength - 0.25);
      } else if (ciWorkflows.length) {
        facts.push("CI configured but no completed runs available");
        strength = Math.min(1, strength + 0.1);
      }
      checks.push({
        id: "tests",
        label: "Automated tests",
        outcome: outcomeFor(strength),
        strength: Number(strength.toFixed(2)),
        detail: testFiles.length
          ? `${testFiles.length} test file(s)${latestRun ? `, CI ${latestRun.conclusion}` : ""}.`
          : "No test files found in the repository.",
        facts,
      });
    }

    /* --- Check 2: documentation --- */
    {
      const headings = (readme.match(/^#{1,3} /gm) ?? []).length;
      const codeBlocks = (readme.match(/```/g) ?? []).length / 2;
      const hasSetup = /(install|setup|getting started|usage|run)/i.test(readme);
      let strength = 0;
      if (readme.length > 300) strength += 0.3;
      if (headings >= 3) strength += 0.2;
      if (codeBlocks >= 1) strength += 0.2;
      if (hasSetup) strength += 0.2;
      if (docFiles.length > 1) strength += 0.1;
      strength = Math.min(1, strength);
      checks.push({
        id: "documentation",
        label: "Documentation quality",
        outcome: outcomeFor(strength),
        strength: Number(strength.toFixed(2)),
        detail: readme
          ? `README is ${readme.length} characters with ${headings} section(s)${hasSetup ? " and setup instructions" : " but no setup instructions"}.`
          : "No README found.",
        facts: [
          `README size: ${readme.length} chars`,
          `${headings} markdown heading(s), ${codeBlocks} code block(s)`,
          `${docFiles.length} documentation file(s) in the repo`,
        ],
      });
    }

    /* --- Check 3: commit pattern --- */
    {
      const meaningful = commits.filter((c) => c.commit.message.trim().length > 12).length;
      const msgQuality = commits.length ? meaningful / commits.length : 0;
      let strength = 0;
      if (activeDays >= 5) strength += 0.35;
      else if (activeDays >= 2) strength += 0.2;
      if (spanDays >= 14) strength += 0.3;
      else if (spanDays >= 3) strength += 0.15;
      strength += msgQuality * 0.35;
      strength = Math.min(1, strength);
      checks.push({
        id: "commit_pattern",
        label: "Commit history",
        outcome: outcomeFor(strength),
        strength: Number(strength.toFixed(2)),
        detail:
          commits.length > 1
            ? `${commits.length} commit(s) across ${activeDays} day(s), spanning ${spanDays} day(s).`
            : "Only a single commit — no development history to read.",
        facts: [
          `${commits.length} commits analysed (most recent 100)`,
          `${activeDays} distinct active days over ${spanDays} days`,
          `${Math.round(msgQuality * 100)}% of commit messages are descriptive`,
        ],
      });
    }

    /* --- Check 4: engineering quality signals --- */
    {
      let strength = 0;
      if (codeFiles.length >= 5) strength += 0.3;
      else if (codeFiles.length >= 2) strength += 0.15;
      if (lintFiles.length) strength += 0.25;
      if (ciWorkflows.length) strength += 0.2;
      if (files.length && codeFiles.length / files.length > 0.2) strength += 0.15;
      if (!meta.fork) strength += 0.1;
      strength = Math.min(1, strength);
      checks.push({
        id: "quality",
        label: "Engineering quality criteria",
        outcome: outcomeFor(strength),
        strength: Number(strength.toFixed(2)),
        detail: `${codeFiles.length} source file(s), ${lintFiles.length} config/lint file(s), ${ciWorkflows.length} CI workflow(s).`,
        facts: [
          `Repository is ${meta.fork ? "a fork" : "original (not a fork)"}`,
          `Primary language: ${meta.language ?? "unknown"}`,
          `${files.length} files in the default branch`,
        ],
      });
    }

    /* --- Check 5: skill relevance --- */
    {
      const hint = SKILL_HINTS[skillKey];
      const matches = hint ? paths.filter((p) => hint.test(p)) : [];
      const langMatch = (meta.language ?? "").toLowerCase() === skillKey;
      const strength = hint
        ? matches.length >= 3 || langMatch
          ? 0.9
          : matches.length
            ? 0.6
            : 0.2
        : langMatch
          ? 0.8
          : 0.5;
      if (!hint) warnings.push(`No file-level fingerprint for "${data.skillName}" — relevance judged by the AI review.`);
      checks.push({
        id: "relevance",
        label: `Evidence actually uses ${data.skillName}`,
        outcome: outcomeFor(strength),
        strength: Number(strength.toFixed(2)),
        detail: matches.length
          ? `${matches.length} file(s) in this repo relate to ${data.skillName}.`
          : langMatch
            ? `Repository's primary language is ${meta.language}.`
            : `No obvious ${data.skillName} files detected.`,
        facts: matches.slice(0, 5).length ? matches.slice(0, 5) : [`Primary language: ${meta.language ?? "unknown"}`],
      });
    }

    /* --- AI code review over sampled real files --- */
    let dimensions: AnalysisDimension[] = [];
    let summary = "";
    if (apiKey) {
      const sample = codeFiles
        .filter((p) => !TEST_RE.test(p))
        .slice(0, 4)
        .concat(testFiles.slice(0, 2));
      const contents: string[] = [];
      for (const p of sample) {
        const blob = await gh<{ content?: string; encoding?: string }>(
          `/repos/${owner}/${repo}/contents/${encodeURI(p)}?ref=${meta.default_branch}`,
        );
        if (blob?.content) {
          try {
            const text = b64ToText(blob.content).slice(0, 8000);
            contents.push(`--- ${p} ---\n${text}`);
          } catch {
            /* binary or oversized file — skip */
          }
        }
      }
      const context = [
        `Repository: ${meta.full_name} (${meta.fork ? "fork" : "original"}), language ${meta.language ?? "unknown"}.`,
        `${commits.length} commits over ${spanDays} days on ${activeDays} active days.`,
        `${codeFiles.length} source files, ${testFiles.length} test files, CI: ${latestRun?.conclusion ?? (ciWorkflows.length ? "configured, no runs" : "none")}.`,
        readme ? `README:\n${readme.slice(0, 6000)}` : "No README.",
        contents.length ? `Sampled source files:\n${contents.join("\n\n")}` : "No readable source files.",
        data.notes ? `Student notes: ${data.notes}` : "",
      ].join("\n\n");
      const r = await aiReview(apiKey, data.skillName, context);
      if (r) {
        dimensions = r.dimensions;
        summary = r.summary;
      } else warnings.push("AI code review was unavailable — the result uses the deterministic checks only.");
    } else {
      warnings.push("AI review key missing — the result uses the deterministic checks only.");
    }

    if (treeRaw?.truncated) warnings.push("Repository is large — the file listing was truncated by GitHub.");
    if (!commitsRaw) warnings.push("Commit history could not be read.");

    const checkScore = checks.reduce((a, c) => a + c.strength, 0) / checks.length;
    const aiScore = dimensions.length ? dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length / 100 : null;
    const overall = Math.round((aiScore === null ? checkScore : checkScore * 0.6 + aiScore * 0.4) * 100);
    const failed = checks.filter((c) => c.outcome === "fail");
    const outcome: VerificationAnalysis["outcome"] =
      overall >= 70 && failed.length === 0 ? "verified" : overall >= 45 ? "partial" : "not_verified";

    const reason =
      summary ||
      `${checks.filter((c) => c.outcome === "pass").length} of ${checks.length} checks passed on ${meta.full_name}.`;

    return {
      analysedAt: new Date().toISOString(),
      source: "github",
      repo: {
        fullName: meta.full_name,
        url: meta.html_url,
        defaultBranch: meta.default_branch,
        isFork: meta.fork,
        language: meta.language,
        files: files.length,
        commits: commits.length,
        firstCommit,
        lastCommit,
        testFiles: testFiles.slice(0, 10),
        ciWorkflows,
        latestCiConclusion: latestRun?.conclusion ?? undefined,
        readmeBytes: readme.length,
      },
      checks,
      dimensions,
      overall,
      outcome,
      reason,
      warnings,
    };
  });
