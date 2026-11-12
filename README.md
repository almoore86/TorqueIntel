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

**Current scope:** Ford Mustang GT, model years 2015 through 2023.

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
`vehicle_comparison`) and plans which tools to run. It never runs a tool
itself.

## Tools

| Tool | Data source | Status |
|---|---|---|
| `getVehicleInfo` | `data/vehicles.json` | Working |
| `getRecalls` | NHTSA public recalls API (no key) | Working |
| `compareVehicles` | `data/vehicles.json` + NHTSA recall counts | Working, needs approval |
| `searchReliability` | none yet | Placeholder; reports "not available" |

Torque Intel does not invent data. When a source has nothing, or cannot be
reached, the response says so.

Recall data comes from
`https://api.nhtsa.gov/recalls/recallsByVehicle?make=…&model=…&modelYear=…`.
NHTSA lists recalls by model, not by trim, so recall results cover the whole
Mustang line for a model year.

## Human approval gate

`compareVehicles` never runs on its own. The app stores the pending action
as data, shows the exact tool name and arguments, and waits for **Approve**
or **Cancel**. Closing the window counts as Cancel. A comparison is limited
to 5 model years.

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
| `data/vehicles.json` | Ford Mustang GT dataset, 2015 through 2023 |
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
a recall case passes when the right tool is planned with the right arguments.

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
        "vehicle": { "horsepower": 435 }
    }
}
```
