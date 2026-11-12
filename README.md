---
title: TorqueIntel
emoji: 🏎️
colorFrom: indigo
colorTo: gray
sdk: static
pinned: false
short_description: Automotive intelligent agent for vehicle reliability.
---

# Torque Intel

Torque Intel is a student agentic AI project: a small automotive research
agent that runs entirely in the browser as a Hugging Face Static Space.

It is built with plain HTML, CSS, JavaScript, and JSON. There is no
framework, no build step, and no server.

**Current scope:** Ford Mustang, model years 2015 through 2023, all trims:
V6, EcoBoost, GT, Bullitt, Mach 1, Shelby GT350, Shelby GT350R, and Shelby
GT500. Not every trim was offered in every year. The Mustang Mach-E is a
different vehicle and is not covered.

## How a request flows

```
User
→ Security / Scope Guard      (agent.js: checkRequestSafety)
→ Coordinating Agent          (agent.js: coordinateRequest)
→ Selected tools              (tools.js)
→ Human approval gate         (app.js, before compareVehicles)
→ Response                    (app.js, result modal)
```

The guard always runs first. It blocks unrelated requests, requests for
protected information (API keys, passwords, credentials, environment
variables, system prompts, hidden instructions, configuration), and basic
prompt injection. If a message mixes a real Mustang question with an unsafe
instruction, the unsafe part is removed and the vehicle question is kept.

The coordinator classifies the safe question (`vehicle_information`,
`recall_lookup`, `reliability_research`, `buying_research`,
`vehicle_comparison`), works out which trims and model years were asked
about, and plans which tools to run. It never runs a tool itself.

A question can cover several model years: a list ("2017, 2018 and 2022"), a
range ("2018 through 2020"), or "all years". If no trim is named, every trim
offered in those years is returned.

## Tools

| Tool | Data source | Status |
|---|---|---|
| `getVehicleInfo` | `data/vehicles.json` | Working |
| `getRecalls` | NHTSA public recalls API (no key) | Working |
| `searchReliability` | NHTSA public owner-complaints API (no key) | Working |
| `compareVehicles` | `data/vehicles.json` + NHTSA recall and complaint counts | Working, needs approval |

Torque Intel does not invent data. When a source has nothing, or cannot be
reached, the response says so.

NHTSA data comes from:

- `https://api.nhtsa.gov/recalls/recallsByVehicle?make=…&model=…&modelYear=…`
- `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=…&model=…&modelYear=…`

NHTSA lists recalls and complaints by model, not by trim, so those results
cover the whole Mustang line for a model year.

Reliability results are the owner complaints filed publicly with NHTSA:
how many, how many mention a crash, fire, injury or death, which components
are named most, and the most recent complaint texts. NHTSA publishes these
without verifying each one, and the totals depend on how many cars were sold
and how old they are. Torque Intel shows the counts and does not turn them
into a reliability score. NHTSA is currently the only reliability source.

## Human approval gate

`compareVehicles` never runs on its own. The app stores the pending action
as data, shows the exact tool name and arguments, and waits for **Approve**
or **Cancel**. Closing the window counts as Cancel. A comparison is limited
to 5 vehicles (model years x trims) and needs at least one trim named.

## Limits

| Limit | Value |
|---|---|
| `MAX_TURNS_PER_SESSION` | 10 |
| `MAX_TOOL_CALLS_PER_TURN` | 4 |
| `MAX_COMPARISON_VEHICLES` | 5 |
| `MAX_RESULTS_PER_TOOL` | 10 |

## Files

| File | Purpose |
|---|---|
| `index.html` | The page: question box, status line, result modal |
| `style.css` | Styling for the app and the evaluation page |
| `agent.js` | Limits, security / scope guard, coordinating agent (no page code) |
| `tools.js` | Tools that return data (no page code) |
| `app.js` | Page logic: runs the plan, approval gate, result display |
| `data/vehicles.json` | Ford Mustang dataset, all trims, 2015 through 2023 |
| `eval/test-cases.json` | Evaluation cases |
| `evaluation/evaluation.js` | Evaluation harness (pass@1 and pass^3) |
| `evaluation/index.html` | Evaluation page |
| `evaluation/results.json` | Saved results of the last terminal run |
| `CLAUDE.md` | Project specification |

## Run locally

The app loads JSON with `fetch`, so it must be served over HTTP rather than
opened as a file:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` for the app, or
`http://localhost:8000/evaluation/` for the evaluation page.

## Evaluation

Every case in `eval/test-cases.json` is run three times through the same
guard and coordinator the app uses. Cases that look up a vehicle are also
checked against `data/vehicles.json`.

- **pass@1**: share of cases that pass on their first run
- **pass^3**: share of cases that pass on all three runs

The agent is rule-based, so the three runs normally agree, and no randomness
is added. Every individual run is kept in the results for manual review.
The harness does not call NHTSA, because live recall data changes over time;
a recall or reliability case passes when the right tool is planned with the
right arguments.

Run it in the browser at `/evaluation/`, or in a terminal:

```bash
node evaluation/evaluation.js
```

The terminal run also rewrites `evaluation/results.json`. Node is only used
to run the same plain JavaScript file; the project has no dependencies.

A test case looks like this. Only the fields listed under `expected` are
checked:

```json
{
    "id": "info-2017",
    "category": "vehicle_information",
    "input": "What engine is in a 2017 Mustang GT?",
    "expected": {
        "allowed": true,
        "intent": "vehicle_information",
        "status": "ready",
        "tools": ["getVehicleInfo"],
        "vehicles": [{ "trim": "GT", "horsepower": 435 }]
    }
}
```
