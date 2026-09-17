import { requirementsForRole } from "@/lib/skillbridge-roles";
import type { Skill } from "@/lib/skillbridge-store";

export type RoadmapStepDefinition = {
  id: string;
  title: string;
  detail: string;
  auto?: boolean;
};

export function buildSteps(skills: Skill[], role?: string): RoadmapStepDefinition[] {
  const verified = new Set(
    skills.filter((skill) => skill.status === "verified").map((skill) => skill.name.toLowerCase()),
  );
  const requirements = requirementsForRole(role);
  const core = requirements.filter((requirement) => requirement.importance === "core");
  const helpful = requirements.filter((requirement) => requirement.importance === "helpful");

  return [
    { id: "profile", title: "Set up your profile", detail: "Name, year of study and target role.", auto: true },
    { id: "connect", title: "Connect your accounts", detail: "GitHub, coding practice and certificates feed your score." },
    ...core.map((requirement) => ({
      id: `core-${requirement.skill}`,
      title: `Verify ${requirement.skill}`,
      detail: requirement.why,
      auto: verified.has(requirement.skill.toLowerCase()),
    })),
    ...helpful.map((requirement) => ({
      id: `helpful-${requirement.skill}`,
      title: `Strengthen ${requirement.skill}`,
      detail: requirement.why,
      auto: verified.has(requirement.skill.toLowerCase()),
    })),
    { id: "resume", title: "Generate your verified resume", detail: "Built only from evidence you can back up." },
    { id: "interview", title: "Run three mock interviews", detail: "Practise explaining your own projects out loud." },
    { id: "apply", title: "Approve your first application", detail: "Nothing is sent until you tap approve." },
  ];
}
