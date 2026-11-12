/*
    Torque Intel - page logic

    This file owns everything the user sees: reading the
    question, asking the agent for a plan (agent.js), running
    the planned tools (tools.js), the human approval gate,
    the evidence review (agent.js), and showing results in
    the modal.

    Load order in index.html: agent.js, tools.js, app.js.
*/

const analyzeButton =
    document.getElementById("analyzeButton");

const userQuestion =
    document.getElementById("userQuestion");

const statusArea =
    document.getElementById("statusArea");

const resultModal =
    document.getElementById("resultModal");

const resultTitle =
    document.getElementById("resultTitle");

const resultContent =
    document.getElementById("resultContent");

const closeModal =
    document.getElementById("closeModal");


let sessionTurns = 0;

/*
    Human gate: the action waiting for approval, or null.

        {
            tool: "compareVehicles",
            args: { make, model, trims, years, criteria },
            status: "pending" | "approved",
            sanitized: true | false,
            unsupportedYears: []
        }
*/
let pendingAction = null;


const SCOPE_TEXT =
    `${SUPPORTED_VEHICLE.make} ${SUPPORTED_VEHICLE.model}, model years ${SUPPORTED_VEHICLE.minYear} through ${SUPPORTED_VEHICLE.maxYear}`;

const TRIM_LIST_TEXT =
    TRIMS.map(trim => trim.name).join(", ");

const INTENT_TITLES = {
    vehicle_information: "Vehicle Information",
    recall_lookup: "Recall Research",
    reliability_research: "Reliability Research",
    buying_research: "Buying Research",
    vehicle_comparison: "Vehicle Comparison"
};

const CRITERIA_LABELS = {
    engine: "Engine",
    transmission: "Transmission options",
    horsepower: "Horsepower",
    drivetrain: "Drivetrain",
    recalls: "Recalls (NHTSA, all trims)",
    reliability: "Owner complaints (NHTSA, all trims)"
};

const NHTSA_ERROR_TEXT = {

    network_error:
        "Torque Intel could not reach NHTSA, so nothing is shown. This does not mean there is nothing on file.",

    service_error:
        "NHTSA returned an unexpected response, so nothing is shown. This does not mean there is nothing on file."
};


/* =====================================================
    Request handling
   ===================================================== */

/*
    Entry point for a user request.
*/
async function handleUserRequest() {

    const question =
        userQuestion.value.trim();

    if (!question) {
        statusArea.textContent =
            "Enter a vehicle question first.";

        return;
    }


    if (sessionTurns >= MAX_TURNS_PER_SESSION) {

        statusArea.textContent =
            "This Torque Intel session has reached its maximum number of requests.";

        return;
    }


    sessionTurns++;

    statusArea.textContent =
        "Torque Intel is reviewing your request...";

    analyzeButton.disabled = true;


    try {

        /*
            Guard first, then coordinator (see agent.js).
        */
        const analysis =
            analyzeRequest(question);

        await actOnAnalysis(analysis);
    }

    finally {

        statusArea.textContent = "";

        analyzeButton.disabled = false;
    }
}


/*
    Decides what to do with the agent's plan.
*/
async function actOnAnalysis(analysis) {

    switch (analysis.status) {

        case "blocked":

            showMessage(
                analysis.intent === "harmful_request"
                    ? "Torque Intel Can't Help With That"
                    : "Request Not Available",
                [analysis.message]
            );

            return;


        case "unsupported_vehicle":

            showMessage(
                "Unsupported Vehicle",
                [
                    "Torque Intel does not have data for that vehicle.",
                    `It currently supports only the ${SCOPE_TEXT}.`
                ]
            );

            return;


        case "unsupported_year":

            showMessage(
                "Unsupported Model Year",
                [
                    `Torque Intel does not have data for the ${analysis.unsupportedYears.join(", ")} Mustang.`,
                    `It currently supports only the ${SCOPE_TEXT}.`
                ]
            );

            return;


        case "missing_year":

            showMessage(
                "Model Year Needed",
                analysis.intent === "vehicle_comparison"
                    ? [
                        "A comparison needs at least two vehicles: two model years, or two trims.",
                        "Example: Compare the 2015 and 2018 Mustang GT."
                    ]
                    : [
                        "Tell Torque Intel which model year or years you mean.",
                        "Examples: What engine is in a 2017 Mustang GT? Recalls for the 2018 to 2020 Mustang."
                    ]
            );

            return;


        case "missing_trim":

            showMessage(
                "Trim Needed",
                [
                    "Tell Torque Intel which Mustang trim or trims to compare.",
                    `Supported trims: ${TRIM_LIST_TEXT}.`,
                    "Example: Compare the 2020 Mustang EcoBoost and GT."
                ]
            );

            return;


        case "too_many_vehicles":

            showMessage(
                "Too Many Vehicles",
                [
                    `Torque Intel can compare up to ${MAX_COMPARISON_VEHICLES} vehicles at once. You asked for ${analysis.years.length * analysis.trims.length} (${analysis.years.length} model years x ${analysis.trims.length} trims).`
                ]
            );

            return;


        case "needs_approval":

            pendingAction = {
                tool: analysis.toolCalls[0].tool,
                args: analysis.toolCalls[0].args,
                status: "pending",
                sanitized: analysis.sanitized,
                unsupportedYears: analysis.unsupportedYears
            };

            showApprovalGate(pendingAction);

            return;


        case "ready": {

            const results =
                await runToolCalls(analysis.toolCalls);

            showResult(
                INTENT_TITLES[analysis.intent],
                sanitizedNoticeHtml(analysis.sanitized) +
                skippedYearsNoticeHtml(analysis.unsupportedYears) +
                evidenceReviewHtml(reviewEvidence(results)) +
                results.map(toolResultHtml).join("")
            );

            return;
        }


        default:

            showMessage(
                "Request",
                [
                    "Torque Intel could not determine how to handle that request."
                ]
            );
    }
}


/*
    Runs the planned tool calls in order,
    never more than MAX_TOOL_CALLS_PER_TURN.
*/
async function runToolCalls(toolCalls) {

    const results = [];

    for (const call of toolCalls.slice(0, MAX_TOOL_CALLS_PER_TURN)) {

        statusArea.textContent =
            `Running ${call.tool}...`;

        results.push(
            await TOOLS[call.tool](call.args)
        );
    }

    return results;
}


/* =====================================================
    Human approval gate
   ===================================================== */

function showApprovalGate(action) {

    const { make, model, trims, years, criteria } =
        action.args;

    const html = `
        ${sanitizedNoticeHtml(action.sanitized)}
        ${skippedYearsNoticeHtml(action.unsupportedYears)}
        <div class="result-section">
            <h3>Approval Required</h3>
            <p>
                Torque Intel wants to run the tool below.
                Nothing runs until you approve it.
            </p>
            <div class="result-stack">
                ${resultItemHtml(["Tool", action.tool])}
            </div>
            <h3>Arguments</h3>
            <div class="result-grid">
                ${resultItemHtml(["make", make])}
                ${resultItemHtml(["model", model])}
                ${resultItemHtml(["trims", trims.join(", ")])}
                ${resultItemHtml(["years", years.join(", ")])}
            </div>
            <div class="result-stack">
                ${resultItemHtml(["criteria", criteria.join(", ")])}
            </div>
            <div class="button-row">
                <button
                    type="button"
                    class="primary-button"
                    data-action="approve"
                >
                    Approve
                </button>
                <button
                    type="button"
                    class="secondary-button"
                    data-action="cancel"
                >
                    Cancel
                </button>
            </div>
        </div>
    `;

    showResult(
        "Torque Intel Action Request",
        html
    );
}


async function approvePendingAction() {

    if (
        !pendingAction ||
        pendingAction.status !== "pending"
    ) {
        return;
    }

    const action = pendingAction;

    action.status = "approved";

    showMessage(
        INTENT_TITLES.vehicle_comparison,
        [`Running ${action.tool}...`]
    );

    const result =
        await TOOLS[action.tool](action.args);

    /*
        If the user closed the modal while the tool was
        running, do not reopen it.
    */
    if (pendingAction !== action) {
        return;
    }

    pendingAction = null;

    showResult(
        INTENT_TITLES.vehicle_comparison,
        evidenceReviewHtml(reviewEvidence([result])) +
        toolResultHtml(result)
    );
}


function cancelPendingAction() {

    pendingAction = null;

    showMessage(
        "Comparison Cancelled",
        [
            "The comparison was not run. No tool was executed."
        ]
    );
}


/* =====================================================
    Display: tool results -> HTML
   ===================================================== */

function toolResultHtml(result) {

    switch (result.tool) {

        case "getVehicleInfo":
            return vehicleInfoHtml(result);

        case "getRecalls":
            return recallsHtml(result);

        case "searchReliability":
            return reliabilityHtml(result);

        case "compareVehicles":
            return comparisonHtml(result);

        default:
            return sectionHtml(
                "Tool Not Available",
                ["This tool is not available yet."]
            );
    }
}


function vehicleName(vehicle) {

    return [
        vehicle.year,
        vehicle.make,
        vehicle.model,
        vehicle.trim
    ].join(" ");
}


function vehicleInfoHtml(result) {

    if (result.error === "data_unavailable" || result.error === "invalid_arguments") {

        return sectionHtml(
            "Specifications",
            [
                "Torque Intel could not load its vehicle dataset, so no specifications are shown."
            ]
        );
    }

    const { vehicles, missing } =
        result.data;

    const missingHtml =
        missing.length
            ? `
                <p class="note">
                    No entry in the Torque Intel dataset for:
                    ${escapeHtml(
                        missing
                            .map(item => `${item.year} Mustang ${item.trim || ""}`.trim())
                            .join(", ")
                    )}.
                </p>
            `
            : "";

    if (vehicles.length === 0) {

        return `
            <div class="result-section">
                <h3>Specifications</h3>
                ${missingHtml}
                <p>Supported trims: ${escapeHtml(TRIM_LIST_TEXT)}. Not every trim was offered in every year.</p>
            </div>
        `;
    }


    /* One vehicle: cards. Several vehicles: a table. */
    if (vehicles.length === 1) {

        const vehicle = vehicles[0];

        const items = [
            ["Engine", vehicle.engine],
            ["Horsepower", `${vehicle.horsepower} hp`],
            ["Drivetrain", vehicle.drivetrain],
            ["Transmission Options", vehicle.transmissions.join(", ")]
        ];

        return `
            <div class="result-section">
                <h3>${escapeHtml(vehicleName(vehicle))}</h3>
                <div class="result-grid">
                    ${items.map(resultItemHtml).join("")}
                </div>
                ${missingHtml}
                ${sourceHtml(result.source)}
            </div>
        `;
    }

    const rows =
        vehicles
            .map(vehicle => `
                <tr>
                    <th scope="row">${escapeHtml(`${vehicle.year} ${vehicle.trim}`)}</th>
                    <td>${escapeHtml(vehicle.engine)}</td>
                    <td class="nowrap">${escapeHtml(vehicle.horsepower)} hp</td>
                    <td>${escapeHtml(vehicle.transmissions.join(", "))}</td>
                    <td>${escapeHtml(vehicle.drivetrain)}</td>
                </tr>
            `)
            .join("");

    return `
        <div class="result-section">
            <h3>Specifications: Ford Mustang</h3>
            <div class="table-scroll">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th scope="col">Vehicle</th>
                            <th scope="col">Engine</th>
                            <th scope="col">Horsepower</th>
                            <th scope="col">Transmissions</th>
                            <th scope="col">Drivetrain</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${missingHtml}
            ${sourceHtml(result.source)}
        </div>
    `;
}


/*
    Shared layout for NHTSA results that come per model year.
    One year is shown open; several years are shown as
    collapsible blocks.
*/
function perYearHtml(years, yearSummary, yearBody) {

    if (years.length === 1) {
        return yearBody(years[0]);
    }

    return years
        .map(year => `
            <details class="year-block">
                <summary>
                    <strong>${escapeHtml(year.modelYear)}</strong>
                    ${escapeHtml(yearSummary(year))}
                </summary>
                ${yearBody(year)}
            </details>
        `)
        .join("");
}


function yearRangeText(years) {

    const list =
        years.map(year => year.modelYear);

    return list.length === 1
        ? String(list[0])
        : list.join(", ");
}


function recallsHtml(result) {

    if (!result.ok) {

        return sectionHtml(
            "Safety Recalls",
            ["The recall lookup needs a make, model, and model year."]
        );
    }

    const { make, model, years } =
        result.data;

    const summary = year =>
        !year.ok
            ? "could not be checked"
            : `${year.totalCount} recall${year.totalCount === 1 ? "" : "s"}`;

    const body = year => {

        if (!year.ok) {

            return `
                <p>${escapeHtml(NHTSA_ERROR_TEXT[year.error] || NHTSA_ERROR_TEXT.service_error)}</p>
                <p>You can check directly at nhtsa.gov/recalls.</p>
            `;
        }

        if (year.totalCount === 0) {

            return `
                <p>
                    NHTSA returned no recalls for the
                    ${escapeHtml(`${year.modelYear} ${make} ${model}`)}.
                </p>
            `;
        }

        const countText =
            year.recalls.length < year.totalCount
                ? `NHTSA lists ${year.totalCount} recalls for ${year.modelYear}. Showing the ${year.recalls.length} most recent.`
                : `NHTSA lists ${year.totalCount} recall${year.totalCount === 1 ? "" : "s"} for ${year.modelYear}.`;

        return `
            <p>${escapeHtml(countText)}</p>
            <div class="result-stack">
                ${year.recalls.map(recallCardHtml).join("")}
            </div>
        `;
    };

    return `
        <div class="result-section">
            <h3>${escapeHtml(`Safety Recalls: ${yearRangeText(years)} ${make} ${model}`)}</h3>
            <p class="note">
                NHTSA lists recalls by model, not by trim. These cover
                the whole ${escapeHtml(model)} line, and a recall may apply to
                only some vehicles. Check a specific car by VIN at
                nhtsa.gov/recalls.
            </p>
            ${perYearHtml(years, summary, body)}
            ${sourceHtml(result.source)}
        </div>
    `;
}


function recallCardHtml(recall) {

    const warnings = [
        recall.parkIt
            ? "NHTSA advises: do not drive this vehicle until repaired."
            : null,
        recall.parkOutside
            ? "NHTSA advises: park this vehicle outside until repaired."
            : null
    ].filter(Boolean);

    const details = [
        ["Summary", recall.summary],
        ["Consequence", recall.consequence],
        ["Remedy", recall.remedy]
    ].filter(([, text]) => text);

    return `
        <div class="result-item recall-card">
            <span class="result-label">
                ${escapeHtml(recall.campaignNumber || "Campaign number not provided")}
                ${recall.reportDate ? " · reported " + escapeHtml(recall.reportDate) : ""}
            </span>
            <strong>${escapeHtml(recall.component || "Component not provided")}</strong>
            ${warnings.map(text => `<p class="warning">${escapeHtml(text)}</p>`).join("")}
            ${details.map(([label, text]) => `
                <p><span class="detail-label">${label}:</span> ${escapeHtml(text)}</p>
            `).join("")}
        </div>
    `;
}


function reliabilityHtml(result) {

    if (!result.ok) {

        return sectionHtml(
            "Owner Complaints",
            ["The complaint lookup needs a make, model, and model year."]
        );
    }

    const { make, model, years } =
        result.data;

    const summary = year =>
        !year.ok
            ? "could not be checked"
            : `${year.totalCount} complaint${year.totalCount === 1 ? "" : "s"}`;

    const body = year => {

        if (!year.ok) {

            return `
                <p>${escapeHtml(NHTSA_ERROR_TEXT[year.error] || NHTSA_ERROR_TEXT.service_error)}</p>
            `;
        }

        if (year.totalCount === 0) {

            return `
                <p>
                    NHTSA has no owner complaints on file for the
                    ${escapeHtml(`${year.modelYear} ${make} ${model}`)}.
                </p>
            `;
        }

        const stats = [
            ["Complaints filed", year.totalCount],
            ["Reporting a crash", year.crashCount],
            ["Reporting a fire", year.fireCount],
            ["Injuries reported", year.injuries],
            ["Deaths reported", year.deaths]
        ];

        const components =
            year.topComponents
                .map(item => `
                    <li>
                        ${escapeHtml(item.component)}:
                        ${escapeHtml(item.count)}
                    </li>
                `)
                .join("");

        return `
            <div class="result-grid">
                ${stats.map(resultItemHtml).join("")}
            </div>
            <p class="detail-label">Most reported components (${escapeHtml(year.modelYear)})</p>
            <ul class="plain-list">${components}</ul>
            <details class="year-block">
                <summary>
                    Most recent complaint${year.recentComplaints.length === 1 ? "" : "s"}
                    (${escapeHtml(year.recentComplaints.length)} of ${escapeHtml(year.totalCount)})
                </summary>
                <div class="result-stack">
                    ${year.recentComplaints.map(complaintCardHtml).join("")}
                </div>
            </details>
        `;
    };

    return `
        <div class="result-section">
            <h3>${escapeHtml(`Owner Complaints: ${yearRangeText(years)} ${make} ${model}`)}</h3>
            <p class="note">
                These are complaints that owners filed publicly with
                NHTSA. NHTSA publishes them without verifying each one.
                They cover every ${escapeHtml(model)} trim, and the totals depend on
                how many cars were sold and how long they have been on
                the road. This is not a reliability rating.
            </p>
            ${perYearHtml(years, summary, body)}
            ${sourceHtml(result.source)}
        </div>
    `;
}


function complaintCardHtml(complaint) {

    const flags = [
        complaint.crash ? "crash reported" : null,
        complaint.fire ? "fire reported" : null,
        complaint.injuries ? `${complaint.injuries} injured` : null,
        complaint.deaths ? `${complaint.deaths} deaths` : null
    ].filter(Boolean);

    return `
        <div class="result-item recall-card">
            <span class="result-label">
                NHTSA ID ${escapeHtml(complaint.odiNumber ?? "not provided")}
                ${complaint.dateFiled ? " · filed " + escapeHtml(complaint.dateFiled) : ""}
            </span>
            <strong>${escapeHtml(complaint.components || "Component not provided")}</strong>
            ${flags.length ? `<p class="warning">${escapeHtml(flags.join(", "))}</p>` : ""}
            ${complaint.summary ? `<p>${escapeHtml(complaint.summary)}</p>` : ""}
        </div>
    `;
}


function comparisonHtml(result) {

    if (!result.ok) {

        return sectionHtml(
            "Comparison",
            [
                result.error === "data_unavailable"
                    ? "Torque Intel could not load its vehicle dataset, so the comparison was not completed."
                    : "The comparison could not be run with those arguments."
            ]
        );
    }

    const { make, model, criteria, rows, otherSources } =
        result.data;

    const spec = value =>
        value ?? "No entry";

    const count = value =>
        value !== null && value !== undefined
            ? String(value)
            : "Could not reach NHTSA";

    const cellText = {

        engine: row =>
            spec(row.engine),

        transmission: row =>
            row.transmissions
                ? row.transmissions.join(", ")
                : "No entry",

        horsepower: row =>
            row.horsepower !== null
                ? `${row.horsepower} hp`
                : "No entry",

        drivetrain: row =>
            spec(row.drivetrain),

        recalls: row =>
            count(row.recallCount),

        reliability: row =>
            count(row.complaintCount)
    };

    const headerCells =
        rows
            .map(row => `<th scope="col">${escapeHtml(`${row.year} ${row.trim}`)}</th>`)
            .join("");

    const bodyRows =
        criteria
            .filter(criterion => cellText[criterion])
            .map(criterion => `
                <tr>
                    <th scope="row">${escapeHtml(CRITERIA_LABELS[criterion])}</th>
                    ${rows.map(row => `<td>${escapeHtml(cellText[criterion](row))}</td>`).join("")}
                </tr>
            `)
            .join("");

    const notFound =
        rows.filter(row => !row.found);

    return `
        <div class="result-section">
            <h3>${escapeHtml(`${make} ${model}`)}</h3>
            <div class="table-scroll">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th scope="col">Vehicle</th>
                            ${headerCells}
                        </tr>
                    </thead>
                    <tbody>${bodyRows}</tbody>
                </table>
            </div>
            ${notFound.length ? `
                <p class="note">
                    "No entry" means the Torque Intel dataset has no
                    ${escapeHtml(notFound.map(row => `${row.year} ${row.trim}`).join(", "))}.
                    Not every trim was offered in every year.
                </p>
            ` : ""}
            <p class="note">
                Recall and complaint counts come from NHTSA and cover
                the whole ${escapeHtml(model)} line for each model year, not one
                trim. Complaints are owner reports that NHTSA publishes
                without verifying each one; a higher count is not a
                reliability rating.
            </p>
            ${sourceHtml(result.source)}
            ${otherSources.map(sourceHtml).join("")}
        </div>
    `;
}


/* =====================================================
    Display helpers
   ===================================================== */

function resultItemHtml([label, value]) {

    return `
        <div class="result-item">
            <span class="result-label">${escapeHtml(label)}</span>
            ${escapeHtml(value)}
        </div>
    `;
}


function sectionHtml(
    heading,
    paragraphs
) {

    return `
        <div class="result-section">
            ${heading ? `<h3>${escapeHtml(heading)}</h3>` : ""}
            ${paragraphs
                .map(text => `<p>${escapeHtml(text)}</p>`)
                .join("")}
        </div>
    `;
}


function sourceHtml(source) {

    if (!source) {
        return "";
    }

    const name =
        escapeHtml(source.name);

    return `
        <p class="source">
            Source:
            ${source.url
                ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${name}</a>`
                : name}
        </p>
    `;
}


/*
    Shows the Evidence Review (agent.js: reviewEvidence) above
    the tool results: what the sources support, and what is
    missing.
*/
function evidenceReviewHtml(review) {

    const STATUS_TEXT = {
        complete: "Everything below came from a named source. Nothing was estimated.",
        partial: "Some of what you asked for could not be backed by a source. The gaps are listed here and nothing was filled in.",
        none: "No source returned usable data for this request, so Torque Intel has nothing to report."
    };

    const itemHtml = item => `
        <li>
            <strong>${escapeHtml(item.tool)}</strong>${item.source ? ` (${escapeHtml(item.source)})` : ""}
            ${item.findings.map(text => `<br>✓ ${escapeHtml(text)}`).join("")}
            ${item.gaps.map(text => `<br>⚠ ${escapeHtml(text)}`).join("")}
        </li>
    `;

    return `
        <div class="result-section">
            <h3>Evidence Review</h3>
            <p class="${review.status === "complete" ? "note" : "warning"}">
                ${escapeHtml(STATUS_TEXT[review.status])}
            </p>
            <details class="year-block">
                <summary>What was checked</summary>
                <ul class="plain-list">
                    ${review.items.map(itemHtml).join("")}
                </ul>
            </details>
        </div>
    `;
}


function sanitizedNoticeHtml(sanitized) {

    return sanitized
        ? `
            <div class="result-section">
                <p class="warning">
                    Part of your request was removed because it asked
                    for protected information or tried to change how
                    Torque Intel works. The vehicle question was kept.
                </p>
            </div>
        `
        : "";
}


function skippedYearsNoticeHtml(unsupportedYears) {

    return unsupportedYears && unsupportedYears.length
        ? `
            <div class="result-section">
                <p class="note">
                    Skipped ${escapeHtml(unsupportedYears.join(", "))}:
                    Torque Intel supports only the ${escapeHtml(SCOPE_TEXT)}.
                </p>
            </div>
        `
        : "";
}


function showMessage(
    title,
    paragraphs
) {

    showResult(
        title,
        sectionHtml("", paragraphs)
    );
}


/*
    Opens modal result.
*/
function showResult(
    title,
    html
) {

    resultTitle.textContent =
        title;

    resultContent.innerHTML =
        html;

    resultModal.classList.remove(
        "hidden"
    );

    closeModal.focus();
}


/*
    Closes the modal.
    Closing while an action is waiting counts as Cancel.
*/
function hideResult() {

    pendingAction = null;

    resultModal.classList.add(
        "hidden"
    );

    userQuestion.focus();
}


/*
    Basic HTML escaping.
    Everything placed into the modal goes through this.
*/
function escapeHtml(text) {

    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =====================================================
    Event listeners
   ===================================================== */

analyzeButton.addEventListener(
    "click",
    handleUserRequest
);


closeModal.addEventListener(
    "click",
    hideResult
);


/*
    Approve / Cancel buttons are created inside the modal,
    so their clicks are handled here on the container.
*/
resultContent.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest("[data-action]");

        if (!button) {
            return;
        }

        if (button.dataset.action === "approve") {
            approvePendingAction();
        }

        if (button.dataset.action === "cancel") {
            cancelPendingAction();
        }
    }
);


resultModal.addEventListener(
    "click",
    event => {

        if (
            event.target === resultModal
        ) {
            hideResult();
        }
    }
);


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape" &&
            !resultModal.classList.contains("hidden")
        ) {
            hideResult();
        }
    }
);
