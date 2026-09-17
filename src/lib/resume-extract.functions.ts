import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { unzipSync, strFromU8 } from "fflate";

const Input = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  /** base64 (no data: prefix), max ~8MB */
  data: z.string().min(10).max(12_000_000),
});

export type ExtractedSkill = {
  name: string;
  category: "technical" | "concept" | "tool" | "project";
  evidenceHint: string;
};

export type RoleSuggestion = { role: string; match: number; why: string };

export type ResumeExtraction = {
  skills: ExtractedSkill[];
  roles: RoleSuggestion[];
  projects: { title: string; technologies: string[] }[];
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function docxToText(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("This DOCX file looks empty or corrupted.");
  const xml = strFromU8(doc);
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SYSTEM = `You read a student's resume and list what they CLAIM to know.
Never judge or verify ability -- extraction is a claim, not proof.
Extract concrete, well-known skill names (deduplicated, canonical casing, e.g. "Git & GitHub", "PostgreSQL", "React").
Categories: technical (languages/frameworks), concept (CS/theory topics like Data Structures, OOP, Machine Learning),
tool (Git, Docker, AWS, VS Code, Figma), project (capabilities demonstrated inside project descriptions,
e.g. Database Design, CRUD Operations, REST API Design, Backend Development).
Also suggest up to 4 plausible career paths with a rough 0-100 match number and one plain-language reason.
Ignore soft skills, hobbies and personal details. Return 8-30 skills.`;

// --- OpenAI-compatible JSON Schema (used for Lovable fallback) ---
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["skills", "roles", "projects"],
  properties: {
    skills: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "category", "evidenceHint"],
        properties: {
          name: { type: "string" },
          category: { type: "string", enum: ["technical", "concept", "tool", "project"] },
          evidenceHint: { type: "string" },
        },
      },
    },
    roles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["role", "match", "why"],
        properties: {
          role: { type: "string" },
          match: { type: "number" },
          why: { type: "string" },
        },
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "technologies"],
        properties: {
          title: { type: "string" },
          technologies: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

// --- Gemini native schema (UPPERCASE types required by Gemini REST API) ---
const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    skills: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          category: { type: "STRING" },
          evidenceHint: { type: "STRING" },
        },
        required: ["name", "category", "evidenceHint"],
      },
    },
    roles: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          role: { type: "STRING" },
          match: { type: "NUMBER" },
          why: { type: "STRING" },
        },
        required: ["role", "match", "why"],
      },
    },
    projects: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          technologies: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
        },
        required: ["title", "technologies"],
      },
    },
  },
  required: ["skills", "roles", "projects"],
};

function normaliseExtraction(parsed: ResumeExtraction): ResumeExtraction {
  const seen = new Set<string>();
  return {
    skills: (parsed.skills ?? [])
      .filter(
        (s) =>
          s?.name &&
          !seen.has(s.name.toLowerCase()) &&
          seen.add(s.name.toLowerCase()) !== undefined
      )
      .slice(0, 40),
    roles: (parsed.roles ?? [])
      .map((r) => ({ ...r, match: Math.max(0, Math.min(100, Math.round(r.match))) }))
      .slice(0, 4),
    projects: (parsed.projects ?? []).slice(0, 8),
  };
}

function isTransientAIError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:429|502|503|504|high demand|rate limit|temporarily unavailable|try again later|overloaded|capacity)/i.test(
    message,
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withTransientRetry<T>(
  provider: string,
  operation: () => Promise<T>,
): Promise<T> {
  const delays = [500, 1500];
  let lastError: unknown;

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientAIError(error) || attempt === delays.length) throw error;
      console.warn(
        `[AI Extraction] ${provider} temporary failure; retrying (${attempt + 1}/${delays.length})`,
      );
      await wait(delays[attempt]);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// --- PRIMARY: Google Gemini REST API ---
async function extractWithGemini(
  geminiApiKey: string,
  fileName: string,
  mimeType: string,
  data: string
): Promise<ResumeExtraction> {
  const model = process.env["GEMINI_MODEL"] ?? "gemini-1.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  console.log("[AI Extraction] Provider: Google Gemini (direct)");
  console.log(`[AI Extraction] Model: ${model}`);
  console.log(`[AI Extraction] File: ${fileName} (${mimeType})`);

  const mime = mimeType.toLowerCase();
  const isPdf = mime.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
  const isDocx =
    mime.includes("wordprocessingml") || fileName.toLowerCase().endsWith(".docx");

  let userParts: unknown[];
  if (isPdf) {
    userParts = [
      {
        inlineData: {
          mimeType: "application/pdf",
          data: data,
        },
      },
      {
        text: "Extract the claimed skills and career paths from this resume.",
      },
    ];
  } else {
    const bytes = base64ToBytes(data);
    const text = isDocx ? docxToText(bytes) : strFromU8(bytes).trim();
    if (text.length < 30) throw new Error("We couldn't read any text from that file.");
    userParts = [
      {
        text: `Extract the claimed skills and career paths from this resume text:\n\n${text.slice(0, 40000)}`,
      },
    ];
  }

  const requestBody = {
    systemInstruction: {
      parts: [{ text: SYSTEM }],
    },
    contents: [
      {
        role: "user",
        parts: userParts,
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_SCHEMA,
      temperature: 0.1,
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": geminiApiKey,
    },
    body: JSON.stringify(requestBody),
  });

  console.log(`[AI Extraction] Gemini HTTP status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[AI Extraction] Gemini error body:", errBody.slice(0, 500));

    let message = `Gemini API error (${res.status})`;
    try {
      const errJson = JSON.parse(errBody) as { error?: { message?: string } };
      if (errJson.error?.message) message = errJson.error.message;
    } catch {
      // keep generic message
    }

    if (res.status === 429) throw new Error("Gemini rate limit reached -- try again in a moment.");
    if (res.status === 401 || res.status === 403)
      throw new Error("Invalid GEMINI_API_KEY. Check your .env file.");
    throw new Error(`Resume analysis failed: ${message}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response.");

  console.log("[AI Extraction] Gemini extraction successful.");

  const parsed = JSON.parse(text) as ResumeExtraction;
  return normaliseExtraction(parsed);
}

// --- FALLBACK: Lovable AI Gateway ---
async function extractWithLovable(
  lovableApiKey: string,
  fileName: string,
  mimeType: string,
  data: string
): Promise<ResumeExtraction> {
  console.log("[AI Extraction] Provider: Lovable AI Gateway (fallback)");
  console.log(`[AI Extraction] File: ${fileName} (${mimeType})`);

  const mime = mimeType.toLowerCase();
  const isPdf = mime.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
  const isDocx =
    mime.includes("wordprocessingml") || fileName.toLowerCase().endsWith(".docx");

  let userContent: unknown;
  if (isPdf) {
    userContent = [
      { type: "text", text: "Extract the claimed skills and career paths from this resume." },
      {
        type: "file",
        file: { filename: fileName, file_data: `data:application/pdf;base64,${data}` },
      },
    ];
  } else {
    const bytes = base64ToBytes(data);
    const text = isDocx ? docxToText(bytes) : strFromU8(bytes).trim();
    if (text.length < 30) throw new Error("We couldn't read any text from that file.");
    userContent = [
      {
        type: "text",
        text: `Extract the claimed skills and career paths from this resume text:\n\n${text.slice(0, 40000)}`,
      },
    ];
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "resume_extraction", strict: true, schema: SCHEMA },
      },
    }),
  });

  console.log(`[AI Extraction] Lovable HTTP status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const body = await res.text();
    console.error("[AI Extraction] Lovable error body:", body.slice(0, 300));
    if (res.status === 429) throw new Error("Too many requests right now -- try again in a moment.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    throw new Error(`Resume analysis failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as ResumeExtraction;

  console.log("[AI Extraction] Lovable extraction successful.");
  return normaliseExtraction(parsed);
}

// --- Server Function ---
export const extractResumeSkills = createServerFn({ method: "POST" })
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ResumeExtraction> => {
    const geminiApiKey =
      process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
    const lovableApiKey = process.env["LOVABLE_API_KEY"];

    if (geminiApiKey) {
      try {
        return await withTransientRetry("Gemini", () =>
          extractWithGemini(geminiApiKey, data.fileName, data.mimeType, data.data),
        );
      } catch (error) {
        if (lovableApiKey && isTransientAIError(error)) {
          console.warn("[AI Extraction] Gemini capacity issue; using Lovable fallback.");
          return withTransientRetry("Lovable", () =>
            extractWithLovable(lovableApiKey, data.fileName, data.mimeType, data.data),
          );
        }
        throw error;
      }
    }

    if (lovableApiKey) {
      return withTransientRetry("Lovable", () =>
        extractWithLovable(lovableApiKey, data.fileName, data.mimeType, data.data),
      );
    }

    throw new Error(
      "AI is not configured. Add GEMINI_API_KEY to your local .env file."
    );
  });