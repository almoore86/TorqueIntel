/*
    Torque Intel - evaluation runner

    Loads eval/test-cases.json, runs every case RUNS_PER_CASE
    times through the guard and coordinator from agent.js,
    and reports:

        pass@1   share of cases that passed on their first run
        pass^3   share of cases that passed on all three runs

    Test case format (test-cases.json is an array of these):

        {
            "id": "info-01",
            "category": "vehicle_information",
            "input": "What engine does a 2020 Mustang GT have?",
            "expected": {
                "allowed": true,
                "intent": "vehicle_information"
            }
        }

    "expected.allowed" is required.
    "expected.intent" is optional; leave it out to check
    only whether the request was allowed or blocked.

    For a blocked request, the actual intent is whatever
    "intent" the guard puts on its result (for example
    "security_request" or "out_of_scope"), or null if the
    guard does not set one.
*/

const TEST_CASES_URL = "test-cases.json";
const RUNS_PER_CASE = 3;

const runEvalButton =
    document.getElementById("runEvalButton");

const evalStatus =
    document.getElementById("evalStatus");

const evalSummary =
    document.getElementById("evalSummary");

const evalResults =
    document.getElementById("evalResults");


/*
    Loads and validates the test cases.
    Throws an Error with a readable message on any problem.
*/
async function loadTestCases() {

    const response =
        await fetch(TEST_CASES_URL, { cache: "no-store" });

    if (!response.ok) {
        throw new Error(
            "test-cases.json could not be loaded."
        );
    }

    const text =
        (await response.text()).trim();

    if (!text) {
        throw new Error(
            "test-cases.json is empty. Add an array of test cases; the format is described at the top of eval/run-eval.js."
        );
    }

    let cases;

    try {
        cases = JSON.parse(text);
    }

    catch (error) {
        throw new Error(
            "test-cases.json is not valid JSON: " + error.message
        );
    }

    if (!Array.isArray(cases) || cases.length === 0) {
        throw new Error(
            "test-cases.json must be a non-empty array of test cases."
        );
    }

    cases.forEach((testCase, index) => {

        const label =
            testCase && testCase.id
                ? `Case "${testCase.id}"`
                : `Case #${index + 1}`;

        if (
            !testCase ||
            typeof testCase.input !== "string" ||
            !testCase.expected ||
            typeof testCase.expected.allowed !== "boolean"
        ) {
            throw new Error(
                `${label} needs an "input" string and an "expected.allowed" true/false value.`
            );
        }
    });

    return cases;
}


/*
    Runs one input through the agent once.
    Returns what the agent actually decided.
*/
function runAgentOnce(input) {

    const guardResult =
        checkRequestSafety(input);

    if (!guardResult.allowed) {

        return {
            allowed: false,
            intent: guardResult.intent ?? null
        };
    }

    return {
        allowed: true,
        intent: coordinateRequest(guardResult.safeQuestion)
    };
}


/*
    Compares one actual outcome with the expected outcome.
*/
function matchesExpected(actual, expected) {

    if (actual.allowed !== expected.allowed) {
        return false;
    }

    if (
        expected.intent !== undefined &&
        actual.intent !== expected.intent
    ) {
        return false;
    }

    return true;
}


/*
    Runs one test case RUNS_PER_CASE times.
*/
function evaluateCase(testCase) {

    const runs = [];

    for (let run = 0; run < RUNS_PER_CASE; run++) {

        let actual;

        try {
            actual = runAgentOnce(testCase.input);
        }

        catch (error) {

            console.error(error);

            actual = {
                allowed: null,
                intent: "error: " + error.message
            };
        }

        runs.push({
            actual,
            passed: matchesExpected(actual, testCase.expected)
        });
    }

    return {
        testCase,
        runs,
        passedFirst: runs[0].passed,
        passedAll: runs.every(run => run.passed)
    };
}


/*
    Display
*/
function describeOutcome(outcome) {

    const verdict =
        outcome.allowed === true ? "allowed"
        : outcome.allowed === false ? "blocked"
        : "error";

    return outcome.intent === undefined || outcome.intent === null
        ? verdict
        : `${verdict} / ${outcome.intent}`;
}


function addCell(row, text, className) {

    const cell = document.createElement("td");

    cell.textContent = text;

    if (className) {
        cell.className = className;
    }

    row.appendChild(cell);
}


function renderSummary(results) {

    const total = results.length;

    const first =
        results.filter(result => result.passedFirst).length;

    const all =
        results.filter(result => result.passedAll).length;

    const percent =
        count => Math.round((count / total) * 100) + "%";

    const items = [
        ["Cases", String(total)],
        ["Runs per case", String(RUNS_PER_CASE)],
        ["pass@1", `${percent(first)} (${first}/${total})`],
        ["pass^3", `${percent(all)} (${all}/${total})`]
    ];

    evalSummary.replaceChildren();

    for (const [label, value] of items) {

        const item = document.createElement("div");
        item.className = "result-item";

        const labelElement = document.createElement("span");
        labelElement.className = "result-label";
        labelElement.textContent = label;

        item.append(labelElement, value);

        evalSummary.appendChild(item);
    }
}


function renderResults(results) {

    const table = document.createElement("table");
    table.className = "eval-table";

    const headRow =
        table.createTHead().insertRow();

    for (const heading of [
        "ID",
        "Category",
        "Input",
        "Expected",
        "Actual",
        "Runs",
        "Result"
    ]) {
        const th = document.createElement("th");
        th.textContent = heading;
        headRow.appendChild(th);
    }

    const body = table.createTBody();

    for (const result of results) {

        const { testCase, runs } = result;

        const row = body.insertRow();

        addCell(row, testCase.id ?? "");
        addCell(row, testCase.category ?? "");
        addCell(row, testCase.input, "eval-input");
        addCell(row, describeOutcome(testCase.expected));
        addCell(row, describeOutcome(runs[0].actual));

        addCell(
            row,
            runs
                .map(run => (run.passed ? "✓" : "✗"))
                .join(" "),
            "eval-runs"
        );

        addCell(
            row,
            result.passedAll ? "PASS" : "FAIL",
            result.passedAll ? "pass" : "fail"
        );
    }

    const wrapper = document.createElement("div");
    wrapper.className = "table-scroll";
    wrapper.appendChild(table);

    evalResults.replaceChildren(wrapper);
}


/*
    Entry point
*/
async function runEvaluation() {

    runEvalButton.disabled = true;

    evalStatus.textContent = "Running evaluation...";
    evalSummary.replaceChildren();
    evalResults.replaceChildren();

    try {

        const cases =
            await loadTestCases();

        const results =
            cases.map(evaluateCase);

        renderSummary(results);
        renderResults(results);

        evalStatus.textContent = "";
    }

    catch (error) {

        evalStatus.textContent = error.message;
    }

    finally {

        runEvalButton.disabled = false;
    }
}


runEvalButton.addEventListener(
    "click",
    runEvaluation
);
