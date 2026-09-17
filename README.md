# SkillBridge AI (28)

Build a web app called "SkillBridge AI" — a career readiness platform that follows a student from first year of college to their first job, with the core idea that skills are VERIFIED, not just self-reported.

DESIGN STYLE

Clean, modern, encouraging — student-facing, not corporate. Soft rounded cards, generous whitespace, a calm primary color (indigo/purple) with teal and coral as accents. Use shadcn/ui components. Dark mode support.

CORE DATA MODEL (Supabase)

- students: id, name, email, target_role, year_of_study

- courses_completed: student_id, course_name, semester, skills_covered (array)

- claimed_skills: student_id, skill_name, source (resume/manual), verified (boolean), confidence_low, confidence_high, last_verified_at

- proof_projects: student_id, skill_id, github_url, status (pending/verified/failed), graded_at

- readiness_scores: student_id, score, confidence_low, confidence_high, calculated_at

- job_applications: student_id, job_title, company, status (drafted/approved/sent), tailored_resume_url

SCREENS TO BUILD

1. Landing page

Hero section explaining the one-line pitch: "The only readiness score employers can trust, because it's earned, not claimed." Include a short 3-step visual (Verify → Track → Apply) and a "Get started" CTA.

2. Onboarding

Simple form: name, current year, target role (dropdown + free text), and resume upload (just store the file for now). Make the target role editable later — show a note that it can be changed anytime.

3. Dashboard (main screen after login)

- Large readiness score card showing a score as a RANGE, not a single number (e.g. "68–79%"), with a short label like "Based on 4 verified projects"

- A skill list split into "Verified" (green check icon) vs "Claimed, not yet verified" (gray outline icon)

- A small "decay" indicator on any skill untouched for 6+ months (amber dot + "may need practice")

- Quick links to Roadmap, Projects, and Mock Interview

4. Skill Gap page

Compare claimed/verified skills against the target role's requirements. Show missing skills as cards, each with: why it matters, estimated time to learn, 2-3 free resources (can be static/mock links), and a "Proof project" button.

5. Roadmap page

Week-by-week plan generated from missing skills, sequenced as a checklist. Each week shows what to learn and links to the matching proof project.

6. Proof Project / Verification page

Student submits a GitHub repo link for a given skill. Show a mock "verification in progress" state, then a result: Verified / Partially verified / Not yet — with plain-language reasoning (e.g. "Found a Dockerfile and 3 related commits").

7. Resume page

Auto-generated resume preview (from verified skills + completed courses), regenerated whenever something new gets verified. Include a "download PDF" button (mock is fine).

8. Mock Interview page

Simple chat-style interface that asks role-specific technical/HR/coding questions and shows a canned feedback message after each answer (mock AI response is fine for prototype).

9. Job Matches page

List of mock job postings ranked by fit %. Each has a "View draft application" button showing a tailored resume/cover note preview, with an "Approve & send" button (mock — no real sending needed) and a clear note that nothing sends without approval.

10. (Optional) College Dashboard

A separate simple view showing aggregate, anonymized stats: average readiness score, most common skill gaps, cohort size. Frame as an admin-only view.

KEY UX PRINCIPLES TO FOLLOW

- Always show scores as ranges, never a single false-precision number

- Visually distinguish "verified" vs "claimed" everywhere skills appear

- Never auto-send anything — every job application requires an explicit approval tap

- Keep tone encouraging and plain-language throughout, not corporate/jargon-heavy

Start with the Landing page, Onboarding, and Dashboard as the first working flow, then add the rest.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://skillbridgeaicareerready.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/32c08b03-9863-4fcb-87d4-f69b2135bedf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
