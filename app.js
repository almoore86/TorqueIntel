/*
    Torque Intel - page logic

    This file owns everything the user sees: reading the
    question, asking the agent for a plan (agent.js), running
    the planned tools (tools.js), the human approval gate,
    and showing results in the modal.

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
            args: { make, model, trim, years, criteria },
            status: "pending" | "approved",
            sanitized: true | false
        }
*/
let pendingAction = null;


const SCOPE_TEXT =
    `${SUPPORTED_VEHICLE.make} ${SUPPORTED_VEHICLE.model} ${SUPPORTED_VEHICLE.trim}, model years ${SUPPORTED_VEHICLE.minYear} through ${SUPPORTED_VEHICLE.maxYear}`;

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
    reliability: "Reliability"
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
                "Request Not Available",
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
                    `Torque Intel does not have data for the ${analysis.unsupportedYears.join(", ")} Mustang GT.`,
                    `It currently supports only the ${SCOPE_TEXT}.`
                ]
            );

            return;


        case "missing_year":

            showMessage(
                "Model Year Needed",
                analysis.intent === "vehicle_comparison"
                    ? [
                        "Name at least two model years to compare.",
                        "Example: Compare the 2015 and 2018 Mustang GT."
                    ]
                    : [
                        "Tell Torque Intel which model year you mean.",
                        "Example: What engine is in a 2017 Mustang GT?"
                    ]
            );

            return;


        case "too_many_vehicles":

            showMessage(
                "Too Many Vehicles",
                [
                    `Torque Intel can compare up to ${MAX_COMPARISON_VEHICLES} model years at once. You asked for ${analysis.years.length}.`
                ]
            );

            return;


        case "needs_approval":

            pendingAction = {
                tool: analysis.toolCalls[0].tool,
                args: analysis.toolCalls[0].args,
                status: "pending",
                sanitized: analysis.sanitized
            };

            showApprovalGate(pendingAction);

            return;


        case "ready": {

            const results =
                await runToolCalls(analysis.toolCalls);

            showResult(
                INTENT_TITLES[analysis.intent],
                sanitizedNoticeHtml(analysis.sanitized) +
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

    const { make, model, trim, years, criteria } =
        action.args;

    const html = `
        ${sanitizedNoticeHtml(action.sanitized)}
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
                ${resultItemHtml(["trim", trim])}
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


function vehicleInfoHtml(result) {

    if (!result.ok) {

        return sectionHtml(
            "Specifications",
            [
                result.error === "not_found"
                    ? `Torque Intel has no entry for that vehicle. It currently supports only the ${SCOPE_TEXT}.`
                    : "Torque Intel could not load its vehicle dataset, so no specifications are shown."
            ]
        );
    }

    const vehicle = result.data;

    const heading = [
        vehicle.year,
        vehicle.make,
        vehicle.model,
        vehicle.trim
    ].join(" ");

    const items = [
        ["Engine", vehicle.engine],
        ["Horsepower", `${vehicle.horsepower} hp`],
        ["Drivetrain", vehicle.drivetrain],
        ["Transmission Options", vehicle.transmissions.join(", ")]
    ];

    return `
        <div class="result-section">
            <h3>${escapeHtml(heading)}</h3>
            <div class="result-grid">
                ${items.map(resultItemHtml).join("")}
            </div>
            ${sourceHtml(result.source)}
        </div>
    `;
}


function recallsHtml(result) {

    const { make, model, modelYear } =
        result.args;

    const heading =
        `Safety Recalls: ${modelYear} ${make} ${model}`;


    if (!result.ok) {

        const reasons = {

            network_error:
                "Torque Intel could not reach NHTSA, so no recall information is shown. This does not mean there are no recalls.",

            service_error:
                "NHTSA returned an unexpected response, so no recall information is shown. This does not mean there are no recalls.",

            invalid_arguments:
                "The recall lookup needs a make, model, and model year."
        };

        return `
            <div class="result-section">
                <h3>${escapeHtml(heading)}</h3>
                <p>${escapeHtml(reasons[result.error] || reasons.service_error)}</p>
                <p>You can check directly at nhtsa.gov/recalls.</p>
                ${sourceHtml(result.source)}
            </div>
        `;
    }


    const { totalCount, recalls } =
        result.data;

    if (totalCount === 0) {

        return `
            <div class="result-section">
                <h3>${escapeHtml(heading)}</h3>
                <p>
                    NHTSA returned no recalls for this
                    make, model, and model year.
                </p>
                ${sourceHtml(result.source)}
            </div>
        `;
    }


    const countText =
        recalls.length < totalCount
            ? `NHTSA lists ${totalCount} recalls. Showing the ${recalls.length} most recent.`
            : `NHTSA lists ${totalCount} recall${totalCount === 1 ? "" : "s"}.`;

    return `
        <div class="result-section">
            <h3>${escapeHtml(heading)}</h3>
            <p>${escapeHtml(countText)}</p>
            <p class="note">
                NHTSA lists recalls by model, not by trim. These
                cover the ${escapeHtml(model)} line for ${escapeHtml(modelYear)},
                and a recall may apply to only some vehicles.
                Check a specific car by VIN at nhtsa.gov/recalls.
            </p>
            <div class="result-stack">
                ${recalls.map(recallCardHtml).join("")}
            </div>
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

    return sectionHtml(
        "Reliability",
        [
            "Torque Intel does not have a verified reliability source connected yet, so it will not give a reliability rating or list of common problems.",
            "Official safety recalls are shown where available."
        ]
    );
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

    const { make, model, trim, criteria, rows, recallSource } =
        result.data;

    const cellText = {

        engine: row =>
            row.engine ?? "Not available",

        transmission: row =>
            row.transmissions
                ? row.transmissions.join(", ")
                : "Not available",

        horsepower: row =>
            row.horsepower !== null
                ? `${row.horsepower} hp`
                : "Not available",

        drivetrain: row =>
            row.drivetrain ?? "Not available",

        recalls: row =>
            row.recallCount !== null
                ? String(row.recallCount)
                : "Could not reach NHTSA",

        reliability: () =>
            "Not available"
    };

    const headerCells =
        rows
            .map(row => `<th scope="col">${escapeHtml(row.year)}</th>`)
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

    return `
        <div class="result-section">
            <h3>${escapeHtml(`${make} ${model} ${trim}`)}</h3>
            <div class="table-scroll">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th scope="col">Model year</th>
                            ${headerCells}
                        </tr>
                    </thead>
                    <tbody>${bodyRows}</tbody>
                </table>
            </div>
            <p class="note">
                Recall counts come from NHTSA and cover the whole
                ${escapeHtml(model)} line for each year, not only the
                ${escapeHtml(trim)}. Reliability is not available because no
                verified reliability source is connected yet.
            </p>
            ${sourceHtml(result.source)}
            ${recallSource ? sourceHtml(recallSource) : ""}
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
