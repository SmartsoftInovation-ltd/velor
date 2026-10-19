---
description: Run the Phase 2 million-data query performance pipeline (seed → inventory → measure → experiment → audit → report → BUGS_FOUND.md). Usage: /phase2-test [backend-folder] [all | <collection> | report]
argument-hint: "[backend-folder] [all | <collection> | report]"
---

You orchestrate the Phase 2 pipeline. You coordinate two subagents and never seed,
measure or write findings yourself:
- `phase2-query-engineer` — seeds, inventories, measures, experiments
- `phase2-query-auditor` — verifies, writes the report and the Phase 2 bugs

Arguments: `$ARGUMENTS`
- BACKEND: the first argument if it is a folder, else `backend/` if it exists, else `.`
- SCOPE: `all` (default), a collection name, or `report`
Pass BACKEND to every subagent call.

## Pipeline

### 0. Pre-flight
- `docker info` must succeed, otherwise stop and tell the user Docker is needed.
- Read `BACKEND/reports/phase2/PROGRESS.md` if it exists and resume from there.
- If `BACKEND/.env.perf` exists, show the user the PERF_MONGO_URI host and db name.
  The db name must contain `perf` and the host must be local. If not, stop.

### 1. Setup (skip if `docker-compose.perf.yml` and `.env.perf` exist)
engineer: "BACKEND=<path>. MODE: setup". Then run `npm run perf:up`.

### 2. Seed (skip if `reports/phase2/seed-stats.json` exists and counts match)
engineer: "BACKEND=<path>. MODE: seed". Show the user the collection counts and seed time.

### 3. Inventory (skip if `QUERY_INVENTORY.md` exists)
engineer: "BACKEND=<path>. MODE: inventory". Show the total query count and red flags.

### 4. Measure + experiment
If SCOPE is a collection, only its queries; else all, largest collection first.
  a. engineer: "MODE: measure [collection]"
  b. engineer: "MODE: experiment [collection]"
  c. auditor: "MODE: audit"
  d. If the audit is FAIL or has MUST-FIX items → engineer fixes them (re-seed,
     add missed queries, harder scenarios), then re-audit. Max 2 rounds.
  e. Print: `<collection>: <PASS/WARN/FAIL counts> — worst p95 <n> ms`.

### 5. Report (always; the only step when SCOPE is `report`)
auditor: "BACKEND=<path>. MODE: report" — this writes PHASE2_QUERY_REPORT.md,
phase2-report.html and the Phase 2 section of BUGS_FOUND.md.
Then confirm that `BACKEND/BUGS_FOUND.md` contains `# Phase 2 — Million-Data Query
Performance Bugs` between the PHASE2 markers and that the Phase 1 content above it
is unchanged (`git diff BUGS_FOUND.md` should show only additions inside the markers).

## Final message to the user
- verdict for Phase 3 (READY / READY WITH GAPS / NOT READY)
- dataset size, queries measured, PASS/WARN/FAIL
- Phase 2 bugs by severity and the 3 worst queries (p95 before → after)
- paths: `BUGS_FOUND.md`, `reports/phase2/PHASE2_QUERY_REPORT.md`,
  `reports/phase2/phase2-report.html`, `reports/phase2/AUDIT.md`
- reminder: the perf DB can be removed with `docker compose -f docker-compose.perf.yml down -v`
