# Phase 2 Agents — Million Data এ Query Fast রাখা

MongoDB তে million million data থাকলেও তোমার backend এর প্রতিটা query fast থাকে কিনা, এই agent গুলো সেটা number দিয়ে প্রমাণ করবে।

| Agent | কাজ | কী করতে পারে না |
|---|---|---|
| `phase2-query-engineer` | আলাদা perf DB তে ১M–৫M realistic data seed করে। Code এর প্রতিটা query খুঁজে বের করে, `explain` আর timing দিয়ে measure করে, তারপর index fix perf DB তে চালিয়ে before/after মাপে | `src/` এর code বদলানো, `BUGS_FOUND.md` এ লেখা |
| `phase2-query-auditor` | প্রতিটা finding নিজে আবার চালিয়ে verify করে। Seed data realistic কিনা আর কোনো query বাদ পড়েছে কিনা check করে, final report বানায়, আর **verified bug গুলো `BUGS_FOUND.md` এ Phase 2 heading এর নিচে লেখে** | Index বানানো, seed করা, code/test edit করা |

## Install

Zip এর ভেতরের file গুলো তোমার repo তে এভাবে রাখো:

```
your-repo/
├── .claude/
│   ├── agents/
│   │   ├── phase2-query-engineer.md
│   │   └── phase2-query-auditor.md
│   └── commands/
│       └── phase2-test.md
└── backend/
    ├── BUGS_FOUND.md            ← Phase 1 এর file, এখানেই Phase 2 যোগ হবে
    └── scripts/
        └── phase2-report.mjs
```

`.claude/` এমন folder এ রাখো যেখান থেকে তুমি `claude` চালাও। Repo root থেকে চালালে command নিজেই `backend/` খুঁজে নেবে।

Requirement: Docker চালু থাকতে হবে। ৫M data এর জন্য disk এ ~২০ GB খালি জায়গা আর ৮ GB+ RAM রাখো।

## Run

| Command | কী হয় |
|---|---|
| `/phase2-test` | পুরো pipeline: setup → seed → query inventory → measure → index experiment → audit → report → BUGS_FOUND.md |
| `/phase2-test backend products` | শুধু `products` collection এর query |
| `/phase2-test backend report` | শুধু final report আর BUGS_FOUND.md আবার update |

## Pipeline

```
1. setup       docker-compose.perf.yml (Mongo + Redis, RAM limit সহ), .env.perf
2. seed        ১M–৫M doc, skewed distribution, valid reference
3. inventory   src/ এর প্রতিটা find/aggregate/count/populate/$lookup → QUERY_INVENTORY.md
4. measure     explain("executionStats") + p50/p95 + প্রতি request এ DB round-trip (N+1)
5. experiment  ESR index বা cursor pagination perf DB তে চালিয়ে before/after + write cost
6. audit       auditor নিজে আবার চালায়, যা reproduce হয় না সেটা বাদ দেয়
7. report      PHASE2_QUERY_REPORT.md + phase2-report.html + BUGS_FOUND.md (Phase 2 section)
```

## Safety

Seed আর index experiment শুধু local perf DB তে চলবে। DB নামে `perf` না থাকলে, অথবা host local না হলে, agent সেখানেই থেমে যাবে। তোমার dev, staging বা production DB তে কিছু হবে না। কাজ শেষে perf DB মুছে ফেলতে:

```bash
docker compose -f docker-compose.perf.yml down -v
```

## Bug গুলো কোথায় পাবে

`backend/BUGS_FOUND.md` এর একদম শেষে auditor এই structure এ লিখবে। Phase 1 এর bug যেমন আছে তেমনই থাকবে:

```markdown
<!-- PHASE2:START -->
---
# Phase 2 — Million-Data Query Performance Bugs

> Run: 2026-10-18 · Dataset: products 5M, orders 10M · MongoDB 7.0

| Severity | Count | ...
| ID | Severity | Endpoint | Problem | p95 before | p95 after fix |

## BUG-P2-001 — COLLSCAN on products filtered by vendor
- Severity / Status / Endpoint / Source / Scenario / Evidence / Expected / Fix / Verified / Tradeoff
<!-- PHASE2:END -->
```

- আবার চালালে marker এর ভেতরের অংশটা replace হবে, তাই duplicate তৈরি হবে না।
- Fix করা bug delete হয় না, সেটার পাশে `Status: Fixed (verified <date>)` লেখা হয়।
- ID `BUG-P2-###` ফরম্যাটে থাকে, তাই Phase 1 এর `BUG-###` এর সাথে মিশে যায় না।

## কোন সমস্যা কত গুরুতর

| সমস্যা | Severity |
|---|---|
| বড় collection এ COLLSCAN, বা limit ছাড়া query | Critical |
| In-memory SORT, docsExamined/nReturned > 100, deep `skip` page > 200ms, N+1, unanchored regex, index ছাড়া `$lookup` | High |
| Query p95 > 50ms / endpoint p95 > 200ms, slow `countDocuments`, cache hit < 70% | Medium |
| Unused বা redundant index | Low |

## Report আবার বানাতে

```bash
cd backend && node scripts/phase2-report.mjs
```
