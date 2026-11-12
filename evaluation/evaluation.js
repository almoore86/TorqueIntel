/*
    Torque Intel - evaluation harness

    What it does:

        1. Loads the test cases from eval/test-cases.json.
        2. Runs every case RUNS_PER_CASE (3) times through
           analyzeRequest() from agent.js. That is the same
           guard + coordinator the real app uses.
        3. For cases that plan a getVehicleInfo call, also looks
           the vehicle up in data/vehicles.json, so wrong data
           is caught as well as wrong routing.
        4. Compares what actually happened with "expected".
        5. Reports pass@1 and pass^3 and keeps every single
           run so failures can be reviewed by hand.

    Metrics:

        pass@1   share of cases that passed on their FIRST run
        pass^3   share of cases that passed on ALL THREE runs

    The agent is rule-based, so the three runs normally agree.
    No randomness is added. If the two numbers ever differ,
    something in the agent is not deterministic.

    The harness does not call NHTSA. Live recall data changes
    over time, which would make results impossible to repeat.
    A recall case passes when the agent plans the right tool
    with the right arguments.

    Two ways to run it (same code, same results):

        Browser:  open evaluation/index.html through a local server
        Terminal: node evaluation/evaluation.js
                  (also rewrites evaluation/results.json)

    Test case format:

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

    Only the fields listed in "expected" are checked.
    Fields you can check:

        allowed, intent, status, sanitized, requiresApproval,
        years, unsupportedYears,
        tools     names of the planned tools, in order
        args      arguments of the first planned tool
        vehicle   the dataset entry for the planned vehicle
*/

const RUNS_PER_CASE = 3;


/* =====================================================
    Core (shared by browser and terminal)
   ===================================================== */

/*
    Runs one input through the agent once and returns
    a plain record of what happened.
*/
function runAgentOnce(input, vehicles) {

    const analysis =
        analyzeRequest(input);

    const infoCall =
        analysis.toolCalls.find(
            call => call.tool === "getVehicleInfo"
        );

    return {
        allowed: analysis.allowed,
        intent: analysis.intent,
        status: analysis.status,
        sanitized: analysis.sanitized,
        requiresApproval: analysis.requiresApproval,
        years: analysis.years,
        unsupportedYears: analysis.unsupportedYears,
        tools: analysis.toolCalls.map(call => call.tool),
        args: analysis.toolCalls.length
            ? analysis.toolCalls[0].args
            : null,
        vehicle: infoCall
            ? lookupVehicle(vehicles, infoCall.args)
            : null
    };
}


/*
    Lists every difference between expected and actual.
    Objects are compared field by field (only the expected
    fields); everything else must be exactly equal.
*/
function findMismatches(expected, actual, path = "") {

    const isPlainObject = value =>
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value);

    if (isPlainObject(expected) && isPlainObject(actual)) {

        return Object.keys(expected).flatMap(
            key =>
                findMismatches(
                    expected[key],
                    actual[key],
                    path ? `${path}.${key}` : key
                )
        );
    }

    if (JSON.stringify(expected) === JSON.stringify(actual)) {
        return [];
    }

    return [
        {
            field: path,
            expected,
            actual: actual === undefined ? null : actual
        }
    ];
}


function evaluateCase(testCase, vehicles) {

    const runs = [];

    for (let run = 1; run <= RUNS_PER_CASE; run++) {

        let actual = null;
        let mismatches;

        try {

            actual =
                runAgentOnce(testCase.input, vehicles);

            mismatches =
                findMismatches(testCase.expected, actual);
        }

        catch (error) {

            mismatches = [
                {
                    field: "(error)",
                    expected: "no error",
                    actual: String(error.message || error)
                }
            ];
        }

        runs.push({
            run,
            passed: mismatches.length === 0,
            mismatches,
            actual
        });
    }

    return {
        id: testCase.id ?? "",
        category: testCase.category ?? "",
        input: testCase.input,
        expected: testCase.expected,
        passedFirstRun: runs[0].passed,
        passedAllRuns: runs.every(run => run.passed),
        runs
    };
}


function validateTestCases(cases) {

    if (!Array.isArray(cases) || cases.length === 0) {
        throw new Error(
            "test-cases.json must be a non-empty array of test cases."
        );
    }

    cases.forEach((testCase, index) => {

        if (
            !testCase ||
            typeof testCase.input !== "string" ||
            !testCase.expected ||
            typeof testCase.expected !== "object"
        ) {
            throw new Error(
                `Test case #${index + 1} needs an "input" string and an "expected" object.`
            );
        }
    });
}


/*
    Runs the whole evaluation and returns the report
    that is shown on the page and saved as results.json.
*/
function runEvaluation(cases, vehicles) {

    validateTestCases(cases);

    const results =
        cases.map(
            testCase =>
                evaluateCase(testCase, vehicles)
        );

    const total = results.length;

    const passedFirst =
        results.filter(result => result.passedFirstRun).length;

    const passedAll =
        results.filter(result => result.passedAllRuns).length;

    return {
        generatedAt: new Date().toISOString(),
        runsPerCase: RUNS_PER_CASE,
        summary: {
            totalCases: total,
            passAt1: {
                passed: passedFirst,
                rate: passedFirst / total
            },
            passPow3: {
                passed: passedAll,
                rate: passedAll / total
            }
        },
        cases: results
    };
}


function formatRate({ passed, rate }, total) {

    return `${Math.round(rate * 100)}% (${passed}/${total})`;
}


/* =====================================================
    Browser
   ===================================================== */

function startInBrowser() {

    const runButton =
        document.getElementById("runEvalButton");

    const downloadButton =
        document.getElementById("downloadResultsButton");

    const statusArea =
        document.getElementById("evalStatus");

    const summaryArea =
        document.getElementById("evalSummary");

    const resultsArea =
        document.getElementById("evalResults");

    let lastReport = null;


    async function loadJson(url, name) {

        const response =
            await fetch(url, { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`${name} could not be loaded.`);
        }

        try {
            return await response.json();
        }

        catch (error) {
            throw new Error(`${name} is not valid JSON.`);
        }
    }


    function element(tag, text, className) {

        const node = document.createElement(tag);

        if (text !== undefined) {
            node.textContent = text;
        }

        if (className) {
            node.className = className;
        }

        return node;
    }


    function renderSummary(report) {

        const { totalCases, passAt1, passPow3 } =
            report.summary;

        const items = [
            ["Cases", String(totalCases)],
            ["Runs per case", String(report.runsPerCase)],
            ["pass@1", formatRate(passAt1, totalCases)],
            ["pass^3", formatRate(passPow3, totalCases)]
        ];

        summaryArea.replaceChildren(
            ...items.map(([label, value]) => {

                const item = element("div", undefined, "result-item");

                item.append(
                    element("span", label, "result-label"),
                    value
                );

                return item;
            })
        );
    }


    function describeMismatches(result) {

        const lines = [];

        for (const run of result.runs) {

            for (const mismatch of run.mismatches) {

                lines.push(
                    `Run ${run.run}: ${mismatch.field} expected ` +
                    `${JSON.stringify(mismatch.expected)}, got ` +
                    `${JSON.stringify(mismatch.actual)}`
                );
            }
        }

        return lines.join("\n");
    }


    function renderResults(report) {

        const table = element("table", undefined, "data-table");

        const headRow = table.createTHead().insertRow();

        for (const heading of [
            "ID",
            "Category",
            "Input",
            "Outcome",
            "Runs",
            "Result"
        ]) {
            headRow.appendChild(element("th", heading));
        }

        const body = table.createTBody();

        for (const result of report.cases) {

            const row = body.insertRow();

            const actual = result.runs[0].actual;

            const outcome =
                actual
                    ? `${actual.intent} / ${actual.status}`
                    : "error";

            const inputCell = element("td", undefined, "eval-input");

            inputCell.append(element("div", result.input));

            if (!result.passedAllRuns) {

                inputCell.append(
                    element(
                        "pre",
                        describeMismatches(result),
                        "mismatch"
                    )
                );
            }

            row.append(
                element("td", result.id),
                element("td", result.category),
                inputCell,
                element("td", outcome),
                element(
                    "td",
                    result.runs
                        .map(run => (run.passed ? "✓" : "✗"))
                        .join(" "),
                    "nowrap"
                ),
                element(
                    "td",
                    result.passedAllRuns ? "PASS" : "FAIL",
                    result.passedAllRuns ? "pass" : "fail"
                )
            );
        }

        const wrapper = element("div", undefined, "table-scroll");

        wrapper.appendChild(table);

        resultsArea.replaceChildren(wrapper);
    }


    async function run() {

        runButton.disabled = true;
        downloadButton.hidden = true;

        statusArea.textContent = "Running evaluation...";
        summaryArea.replaceChildren();
        resultsArea.replaceChildren();

        try {

            const [cases, vehicles] =
                await Promise.all([
                    loadJson("../eval/test-cases.json", "eval/test-cases.json"),
                    loadJson("../data/vehicles.json", "data/vehicles.json")
                ]);

            lastReport =
                runEvaluation(cases, Object.values(vehicles));

            renderSummary(lastReport);
            renderResults(lastReport);

            statusArea.textContent = "";
            downloadButton.hidden = false;
        }

        catch (error) {

            statusArea.textContent = error.message;
        }

        finally {

            runButton.disabled = false;
        }
    }


    function downloadResults() {

        const blob =
            new Blob(
                [JSON.stringify(lastReport, null, 4) + "\n"],
                { type: "application/json" }
            );

        const link = document.createElement("a");

        link.href = URL.createObjectURL(blob);
        link.download = "results.json";
        link.click();

        URL.revokeObjectURL(link.href);
    }


    runButton.addEventListener("click", run);
    downloadButton.addEventListener("click", downloadResults);
}


/* =====================================================
    Terminal (node evaluation/evaluation.js)
   ===================================================== */

function startInTerminal() {

    const fs = require("fs");
    const path = require("path");
    const vm = require("vm");

    const root = path.join(__dirname, "..");

    /*
        Load the app's own scripts exactly as a browser
        <script> tag would, so the same code is tested.
    */
    for (const file of ["agent.js", "tools.js"]) {

        vm.runInThisContext(
            fs.readFileSync(path.join(root, file), "utf8"),
            { filename: file }
        );
    }

    const readJson = file =>
        JSON.parse(
            fs.readFileSync(path.join(root, file), "utf8")
        );

    const report =
        runEvaluation(
            readJson("eval/test-cases.json"),
            Object.values(readJson("data/vehicles.json"))
        );

    fs.writeFileSync(
        path.join(__dirname, "results.json"),
        JSON.stringify(report, null, 4) + "\n"
    );


    for (const result of report.cases) {

        console.log(
            `${result.passedAllRuns ? "PASS" : "FAIL"}  ` +
            `${result.runs.map(run => (run.passed ? "✓" : "✗")).join("")}  ` +
            `${result.id}`
        );

        if (!result.passedAllRuns) {

            for (const run of result.runs) {

                for (const mismatch of run.mismatches) {

                    console.log(
                        `        run ${run.run}: ${mismatch.field} expected ` +
                        `${JSON.stringify(mismatch.expected)}, got ` +
                        `${JSON.stringify(mismatch.actual)}`
                    );
                }
            }
        }
    }

    const { totalCases, passAt1, passPow3 } =
        report.summary;

    console.log("");
    console.log(`Cases:  ${totalCases}  (x${report.runsPerCase} runs)`);
    console.log(`pass@1: ${formatRate(passAt1, totalCases)}`);
    console.log(`pass^3: ${formatRate(passPow3, totalCases)}`);
    console.log("Saved:  evaluation/results.json");

    process.exitCode =
        passPow3.passed === totalCases ? 0 : 1;
}


if (typeof document !== "undefined") {
    startInBrowser();
}

else {
    startInTerminal();
}
