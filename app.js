/*
    TorqueIntel - page logic

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
    vehicle_comparison: "Vehicle Comparison",
    vin_lookup: "VIN Recall Lookup",
    fuel_economy: "Fuel Economy"
};

const CRITERIA_LABELS = {
    engine: "Engine",
    transmission: "Transmission options",
    horsepower: "Horsepower",
    torque: "Torque",
    drivetrain: "Drivetrain",
    recalls: "Recalls (NHTSA, all trims)",
    reliability: "Owner complaints (NHTSA, all trims)"
};

const NHTSA_ERROR_TEXT = {

    network_error:
        "TorqueIntel could not reach NHTSA, so nothing is shown. This does not mean there is nothing on file.",

    service_error:
        "NHTSA returned an unexpected response, so nothing is shown. This does not mean there is nothing on file."
};


/* =====================================================
    Request handling
   ===================================================== */

/*
    Entry point for a user request.
*/
async function handleUserRequest(questionOverride) {

    if (typeof questionOverride === "string") {
        userQuestion.value = questionOverride;
    }

    const question =
        userQuestion.value.trim();

    if (!question) {
        statusArea.textContent =
            "Enter a vehicle question first.";

        return;
    }


    if (sessionTurns >= MAX_TURNS_PER_SESSION) {

        statusArea.textContent =
            "This TorqueIntel session has reached its maximum number of requests.";

        return;
    }


    sessionTurns++;

    statusArea.textContent =
        "TorqueIntel is reviewing your request...";

    analyzeButton.disabled = true;


    try {

        /*
            Guard first, then coordinator (see agent.js).
        */
        const analysis =
            analyzeRequest(question);

        if (analysis.allowed) {
            rememberSearch(analysis.sanitized ? analysis.safeQuestion : question);
        }

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
                    ? "TorqueIntel Can't Help With That"
                    : "Request Not Available",
                [analysis.message]
            );

            return;


        case "unsupported_vehicle":

            showMessage(
                "Unsupported Vehicle",
                [
                    "TorqueIntel does not have data for that vehicle.",
                    `It currently supports only the ${SCOPE_TEXT}.`
                ]
            );

            return;


        case "unsupported_year":

            showMessage(
                "Unsupported Model Year",
                [
                    `TorqueIntel does not have data for the ${analysis.unsupportedYears.join(", ")} Mustang.`,
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
                        "Tell TorqueIntel which model year or years you mean.",
                        "Examples: What engine is in a 2017 Mustang GT? Recalls for the 2018 to 2020 Mustang."
                    ]
            );

            return;


        case "invalid_vin":

            showMessage(
                "Check the VIN",
                [
                    "That doesn't look like a valid VIN. A VIN is 17 letters and digits, never uses I, O or Q, and its 9th character is a check digit that didn't match.",
                    "You can find it on the driver's side of the dashboard, visible through the windshield, on the driver's door frame, or on your registration or insurance card."
                ]
            );

            return;


        case "multiple_vins":

            showMessage(
                "One VIN at a Time",
                [
                    "TorqueIntel can look up one VIN per request. Enter a single VIN and try again."
                ]
            );

            return;


        case "missing_trim":

            showMessage(
                "Trim Needed",
                [
                    "Tell TorqueIntel which Mustang trim or trims to compare.",
                    `Supported trims: ${TRIM_LIST_TEXT}.`,
                    "Example: Compare the 2020 Mustang EcoBoost and GT."
                ]
            );

            return;


        case "too_many_vehicles":

            showMessage(
                "Too Many Vehicles",
                [
                    `TorqueIntel can compare up to ${MAX_COMPARISON_VEHICLES} vehicles at once. You asked for ${analysis.years.length * analysis.trims.length} (${analysis.years.length} model years x ${analysis.trims.length} trims).`
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
                results.map(toolResultHtml).join("") +
                followUpsHtml(analysis)
            );

            return;
        }


        default:

            showMessage(
                "Request",
                [
                    "TorqueIntel could not determine how to handle that request."
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
                TorqueIntel wants to run the tool below.
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
        "TorqueIntel Action Request",
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
        toolResultHtml(result) +
        followUpsHtml({
            intent: "vehicle_comparison",
            years: action.args.years,
            trims: action.args.trims
        })
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

        case "getVinRecalls":
            return vinRecallsHtml(result);

        case "getFuelEconomy":
            return fuelEconomyHtml(result);

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
                "TorqueIntel could not load its vehicle dataset, so no specifications are shown."
            ]
        );
    }

    const { vehicles, missing } =
        result.data;

    const missingHtml =
        missing.length
            ? `
                <p class="note">
                    No entry in the TorqueIntel dataset for:
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
            ["Torque", torqueText(vehicle.torque)],
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
                ${specSourcesHtml(vehicles)}
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
                    <td class="nowrap">${escapeHtml(torqueText(vehicle.torque))}</td>
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
                            <th scope="col">Torque</th>
                            <th scope="col">Transmissions</th>
                            <th scope="col">Drivetrain</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${missingHtml}
            ${specSourcesHtml(vehicles)}
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

        return `
            <p>
                ${escapeHtml(`NHTSA lists ${year.totalCount} recall${year.totalCount === 1 ? "" : "s"} across the ${year.modelYear} ${make} ${model} line.`)}
            </p>
        `;
    };

    return `
        <div class="result-section">
            <h3>${escapeHtml(`Safety Recalls: ${yearRangeText(years)} ${make} ${model}`)}</h3>
            ${perYearHtml(years, summary, body)}
            <p class="note">
                Recalls apply to specific vehicles, so they are not listed
                here by model year. Check your VIN to see the recalls for
                your Mustang's year and how to confirm which apply to your car.
            </p>
            <div class="button-row">
                <button type="button" class="accent-button" data-action="open-vin">
                    Check my exact VIN
                </button>
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


/*
    VIN lookup: what NHTSA decoded the VIN as, then every
    recall for that model year, with a clear note that NHTSA's
    public data is not VIN-specific.
*/
function vinRecallsHtml(result) {

    const data =
        result.data || {};

    const vehicle =
        data.vehicle;

    const vin =
        data.vin || (result.args && result.args.vin) || "";


    if (!result.ok) {

        const messages = {

            unsupported_vehicle: vehicle
                ? [
                    `NHTSA decodes VIN ${vin} as a ${describeVinVehicle(vehicle)}.`,
                    `TorqueIntel currently supports only the ${SCOPE_TEXT}, so no recalls were looked up.`
                ]
                : [`TorqueIntel currently supports only the ${SCOPE_TEXT}.`],

            vin_not_decoded: [
                `NHTSA could not identify VIN ${vin}.`,
                "Check the VIN and try again. It is on the driver's side of the dashboard, visible through the windshield, and on the driver's door frame."
            ],

            invalid_arguments: [
                "That VIN is not valid, so nothing was sent to NHTSA."
            ]
        };

        return sectionHtml(
            "VIN Lookup",
            messages[result.error] ||
            [NHTSA_ERROR_TEXT[result.error] || NHTSA_ERROR_TEXT.service_error]
        );
    }


    const details = [
        ["VIN", vin],
        ["Trim (as decoded by NHTSA)", vehicle.trim],
        ["Body", vehicle.bodyClass],
        ["Engine", vehicle.engine],
        ["Drive type", vehicle.driveType],
        ["Assembly plant", vehicle.plant]
    ].filter(([, value]) => value);

    const recalls =
        data.recalls;

    const yearText =
        `${vehicle.year} ${SUPPORTED_VEHICLE.make} ${SUPPORTED_VEHICLE.model}`;

    let recallsBody;

    if (!recalls.ok) {

        recallsBody = `
            <p>${escapeHtml(NHTSA_ERROR_TEXT[recalls.error] || NHTSA_ERROR_TEXT.service_error)}</p>
        `;
    }

    else if (recalls.totalCount === 0) {

        recallsBody = `
            <p>NHTSA returned no recalls for the ${escapeHtml(yearText)}.</p>
        `;
    }

    else {

        const countText =
            recalls.recalls.length < recalls.totalCount
                ? `NHTSA lists ${recalls.totalCount} recalls for the ${yearText}. Showing the ${recalls.recalls.length} most recent.`
                : `NHTSA lists ${recalls.totalCount} recall${recalls.totalCount === 1 ? "" : "s"} for the ${yearText}.`;

        recallsBody = `
            <p>${escapeHtml(countText)}</p>
            <div class="result-stack">
                ${recalls.recalls.map(recallCardHtml).join("")}
            </div>
        `;
    }


    return `
        <div class="result-section">
            <h3>${escapeHtml(`Your vehicle: ${describeVinVehicle(vehicle)}`)}</h3>
            <div class="result-grid">
                ${details.map(resultItemHtml).join("")}
            </div>
            <div class="button-row">
                <button type="button" class="accent-button" data-action="open-sticker" data-vin="${escapeHtml(vin)}">
                    Window Sticker
                </button>
            </div>
            ${sourceHtml(result.source)}
        </div>
        <div class="result-section">
            <h3>${escapeHtml(`Recalls for the ${yearText}`)}</h3>
            <p class="warning">
                NHTSA's public recall data is listed by model year, not by
                VIN. These are all recalls for the ${escapeHtml(yearText)}:
                some may not apply to your car, and this can't show whether a
                recall has already been repaired. To check your exact car,
                enter your VIN at
                <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener noreferrer">nhtsa.gov/recalls</a>
                or ask a Ford dealer.
            </p>
            ${recallsBody}
            ${sourceHtml(SOURCES.nhtsaRecalls)}
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
                    ? "TorqueIntel could not load its vehicle dataset, so the comparison was not completed."
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

        torque: row =>
            row.found
                ? torqueText(row.torque)
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
                    "No entry" means the TorqueIntel dataset has no
                    ${escapeHtml(notFound.map(row => `${row.year} ${row.trim}`).join(", "))}.
                    Not every trim was offered in every year.
                </p>
            ` : ""}
            ${specSourcesHtml(rows.filter(row => row.found).map(row => ({ year: row.year, trim: row.trim, source: row.specSource })))}
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
        none: "No source returned usable data for this request, so TorqueIntel has nothing to report."
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
                    TorqueIntel works. The vehicle question was kept.
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
                    TorqueIntel supports only the ${escapeHtml(SCOPE_TEXT)}.
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

    resultModal.querySelector(".modal-card").classList.remove("wide");

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
    Specs: torque and sources
   ===================================================== */

function torqueText(torque) {

    return torque !== null && torque !== undefined
        ? `${torque} lb-ft`
        : "Not on file";
}


/*
    Links each spec to the Ford document it came from. Entries
    with no Ford document on file are named, so it is clear
    which values come only from the TorqueIntel dataset.
*/
function specSourcesHtml(vehicles) {

    const bySource = new Map();
    const unsourced = [];
    const notes = new Set();

    for (const vehicle of vehicles) {

        if (vehicle.source && vehicle.source.url) {
            bySource.set(vehicle.source.url, vehicle.source);
        }

        else {
            unsourced.push(`${vehicle.year} ${vehicle.trim}`);
        }

        if (vehicle.sourceNote) {
            notes.add(vehicle.sourceNote);
        }
    }

    const links =
        [...bySource.values()]
            .map(source => `
                <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.name)}</a>
            `)
            .join(" · ");

    return `
        ${links ? `<p class="source">Source: ${links}</p>` : ""}
        ${unsourced.length ? `
            <p class="source">
                Source: TorqueIntel vehicle dataset. No Ford specification
                sheet is on file yet for ${escapeHtml(unsourced.join(", "))},
                so torque is not shown for ${unsourced.length === 1 ? "it" : "them"}.
            </p>
        ` : ""}
        ${[...notes].map(note => `<p class="note">${escapeHtml(note)}</p>`).join("")}
    `;
}


/* =====================================================
    Fuel economy
   ===================================================== */

function fuelEconomyHtml(result) {

    if (!result.ok) {

        return sectionHtml(
            "Fuel Economy",
            ["The fuel economy lookup needs at least one model year."]
        );
    }

    const { years, totalConfigurations, shownConfigurations } =
        result.data;

    const rows = [];
    const notes = [];

    for (const year of years) {

        if (!year.ok) {
            notes.push(
                `TorqueIntel could not reach the EPA's fueleconomy.gov for ${year.year}, so nothing is shown for that year.`
            );

            continue;
        }

        for (const item of year.configurations) {

            const rating = [item.city, item.highway, item.combined]
                .map(value => value ?? "?")
                .join(" / ");

            rows.push(`
                <tr>
                    <th scope="row">${escapeHtml(`${year.year} ${item.trim}`)}</th>
                    <td>${escapeHtml(`${item.epaModel}: ${item.description}`)}</td>
                    <td class="nowrap">${escapeHtml(rating)} mpg</td>
                    <td><a href="${escapeHtml(item.epaUrl)}" target="_blank" rel="noopener noreferrer">EPA page</a></td>
                </tr>
            `);
        }

        for (const item of year.missing) {
            notes.push(`${year.year} Mustang ${item.trim}: ${item.reason}`);
        }
    }

    if (totalConfigurations > shownConfigurations) {
        notes.push(
            `Showing ${shownConfigurations} of ${totalConfigurations} EPA configurations. Ask about fewer years or one trim to see the rest.`
        );
    }

    return `
        <div class="result-section">
            <h3>Fuel Economy (EPA)</h3>
            ${rows.length ? `
                <div class="table-scroll">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th scope="col">Vehicle</th>
                                <th scope="col">EPA configuration</th>
                                <th scope="col">City / Hwy / Combined</th>
                                <th scope="col">Details</th>
                            </tr>
                        </thead>
                        <tbody>${rows.join("")}</tbody>
                    </table>
                </div>
            ` : "<p>No EPA ratings were found for this request.</p>"}
            ${notes.map(text => `<p class="note">${escapeHtml(text)}</p>`).join("")}
            <p class="note">
                These are the EPA's official ratings. Real-world mileage
                depends on driving, weather and the car's condition.
            </p>
            ${sourceHtml(result.source)}
        </div>
    `;
}


/* =====================================================
    Follow-up buttons
   ===================================================== */

/* Trims offered each model year, from data/vehicles.json. */
const trimsByYear = new Map();


function listText(items) {

    return items.length <= 1
        ? String(items[0] ?? "")
        : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}


/* Another trim offered the same year, to compare against. */
function otherTrim(year, trim) {

    const offered =
        (trimsByYear.get(year) || []).filter(name => name !== trim);

    const preferred =
        { GT: "EcoBoost", EcoBoost: "GT" }[trim];

    return offered.includes(preferred) ? preferred : offered[0] || null;
}


/*
    Suggested next questions under a result. Each one is an
    ordinary question that goes through the same guard,
    coordinator and evidence review as a typed one.
*/
function followUpsHtml(analysis) {

    const years = analysis.years || [];
    const trims = analysis.trims || [];

    const buttons = [];

    const ask = (label, query) =>
        buttons.push(
            `<button type="button" class="follow-up" data-action="run-query" data-query="${escapeHtml(query)}">${escapeHtml(label)}</button>`
        );

    const checkVin = label =>
        buttons.push(
            `<button type="button" class="follow-up accent" data-action="open-vin">${escapeHtml(label)}</button>`
        );

    if (analysis.intent === "vin_lookup") {
        checkVin("Check another VIN");
    }

    if (years.length) {

        const yearText = listText(years);
        const vehicle = `${yearText} Mustang${trims.length ? " " + listText(trims) : ""}`;

        const compare =
            years.length === 1 && trims.length === 1
                ? otherTrim(years[0], trims[0])
                : null;

        const compareQuery = compare
            ? `Compare the ${years[0]} Mustang ${trims[0]} and ${compare}`
            : null;

        switch (analysis.intent) {

            case "vehicle_information":
                ask("Recalls", `Recalls for the ${yearText} Mustang`);
                ask("Owner complaints", `Owner complaints for the ${vehicle}`);
                ask("Fuel economy", `Fuel economy for the ${vehicle}`);
                if (compareQuery) ask(`Compare with the ${compare}`, compareQuery);
                break;

            case "recall_lookup":
                checkVin("Check my exact VIN");
                ask("Owner complaints", `Owner complaints for the ${vehicle}`);
                ask("Specs", `Specs for the ${vehicle}`);
                break;

            case "reliability_research":
                ask("Buying research", `I'm considering a ${vehicle}. What should I know?`);
                checkVin("Check my exact VIN");
                break;

            case "fuel_economy":
                ask("Specs", `Specs for the ${vehicle}`);
                if (compareQuery) ask(`Compare with the ${compare}`, compareQuery);
                break;

            case "buying_research":
                if (compareQuery) ask(`Compare with the ${compare}`, compareQuery);
                checkVin("Check my exact VIN");
                break;

            case "vehicle_comparison":
                ask("Fuel economy", `Fuel economy for the ${vehicle}`);
                ask("Recalls", `Recalls for the ${yearText} Mustang`);
                break;
        }
    }

    if (buttons.length === 0) {
        return "";
    }

    return `
        <div class="result-section">
            <h3>Next steps</h3>
            <div class="follow-up-row">${buttons.join("")}</div>
        </div>
    `;
}


/* =====================================================
    Check my VIN (popup with live checking)
   ===================================================== */

/* =====================================================
    Window sticker (Ford's official service)
   ===================================================== */

/*
    Ford publishes the original window sticker (Monroney
    label) for many of its vehicles as a free PDF, looked up
    by VIN. If Ford has not released a sticker for that VIN,
    the PDF itself says so. The PDF is shown inside the popup;
    the VIN is sent to Ford only when the sticker is opened.
*/
const WINDOW_STICKER_URL =
    "https://www.windowsticker.forddirect.com/windowsticker.pdf?vin=";

let previousResult = null;


function showWindowSticker(vin) {

    if (!isValidVin(String(vin || ""))) {
        return;
    }

    previousResult = {
        title: resultTitle.textContent,
        html: resultContent.innerHTML
    };

    const url =
        WINDOW_STICKER_URL + encodeURIComponent(vin);

    showResult(
        "Window Sticker",
        `
            <div class="result-section">
                <p class="note">
                    The original window sticker for VIN
                    ${escapeHtml(vin)}, from Ford's window sticker service.
                    If Ford has not released a sticker for this car, the
                    PDF says so. Opening it sends the VIN to Ford.
                </p>
                <iframe
                    class="sticker-frame"
                    src="${escapeHtml(url)}"
                    title="Window sticker for VIN ${escapeHtml(vin)}"
                ></iframe>
                <div class="button-row">
                    <a class="accent-button" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open PDF in a new tab</a>
                    <button type="button" class="secondary-button" data-action="back-to-result">Back to VIN results</button>
                </div>
                <p class="source">
                    Source:
                    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Ford window sticker (Monroney label) service</a>
                </p>
            </div>
        `
    );

    resultModal.querySelector(".modal-card").classList.add("wide");
}


function restorePreviousResult() {

    if (!previousResult) {
        return;
    }

    showResult(previousResult.title, previousResult.html);

    previousResult = null;
}


function showVinDialog() {

    showResult(
        "Check my VIN",
        `
            <div class="result-section">
                <label for="vinInput" class="detail-label">Your 17-character VIN</label>
                <div class="vin-row">
                    <input
                        id="vinInput"
                        class="vin-input"
                        maxlength="17"
                        autocomplete="off"
                        autocapitalize="characters"
                        spellcheck="false"
                        placeholder="1FA6P8CF9J5100001"
                        aria-describedby="vinMessage vinHelp"
                    >
                    <button type="button" class="primary-button" data-action="vin-lookup" id="vinLookupButton" disabled>
                        Look up
                    </button>
                </div>
                <p id="vinMessage" class="vin-message" aria-live="polite"></p>
                <p id="vinHelp" class="note">
                    A VIN is 17 characters of letters and numbers. It never uses
                    the letters I, O or Q, so type the number 0 (zero) and the
                    number 1 (one) instead. Find it on
                    the driver's side of the dashboard, the driver's door frame,
                    or your registration. Your VIN is sent to NHTSA to identify
                    the car.
                </p>
            </div>
        `
    );

    document.getElementById("vinInput").focus();
}


/*
    Checks the VIN as it is typed. The text turns green once
    the VIN is valid (allowed characters and a correct check
    digit); nothing is sent to NHTSA until Look up is pressed.
*/
function checkVinInput(input) {

    const vin =
        input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (input.value !== vin) {
        input.value = vin;
    }

    const message = document.getElementById("vinMessage");
    const button = document.getElementById("vinLookupButton");

    let text = "";
    let state = "";

    const forbidden = vin.match(/[IOQ]/);

    if (!vin) {
        text = "";
    }

    else if (forbidden) {
        state = "invalid";
        text = forbidden[0] === "Q"
            ? "The letter Q is never used in a VIN. Check that character again."
            : `The letter ${forbidden[0]} is never used in a VIN. Did you mean the number ${forbidden[0] === "I" ? "1 (one)" : "0 (zero)"}?`;
    }

    else if (vin.length < 17) {
        text = `${vin.length} of 17 characters`;
    }

    else if (!isValidVin(vin)) {
        state = "invalid";
        text = "That VIN doesn't add up (its 9th character is a check digit). Look for a typo.";
    }

    else {
        state = "valid";
        text = "Valid VIN. Ready to look up with NHTSA.";
    }

    input.classList.toggle("vin-valid", state === "valid");
    input.classList.toggle("vin-invalid", state === "invalid");
    message.className = `vin-message ${state}`;
    message.textContent = text;
    button.disabled = state !== "valid";
}


function submitVinDialog() {

    const input = document.getElementById("vinInput");

    if (!input || !isValidVin(input.value)) {
        return;
    }

    const vin = input.value;

    hideResult();

    handleUserRequest(`Recalls for VIN ${vin}`);
}


/* =====================================================
    Recent searches and suggestions
   ===================================================== */

/*
    Recent searches are kept only in this browser
    (localStorage). They never leave the device.
*/
const RECENT_KEY = "torqueintel.recentSearches";
const MAX_RECENT = 8;

const FRESH_SUGGESTIONS = [
    "What engine is in a 2019 Mustang GT?",
    "Recalls for the 2021 Mustang",
    "Is the 2016 Mustang EcoBoost reliable?",
    "Fuel economy for the 2020 Mustang EcoBoost",
    "Compare the 2020 Mustang GT and Bullitt",
    "I'm considering a 2017 Mustang GT. What should I know?"
];


function loadRecentSearches() {

    try {
        const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");

        return Array.isArray(list) ? list.filter(item => typeof item === "string") : [];
    }

    catch (error) {
        return [];
    }
}


function saveRecentSearches(list) {

    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    }

    catch (error) {
        /* Storage blocked (private window); suggestions still work. */
    }
}


/* VINs are not stored, so a shared computer does not keep them. */
function rememberSearch(question) {

    if (!question || findVinCandidates(question).length) {
        return;
    }

    const recent =
        loadRecentSearches().filter(item => item.toLowerCase() !== question.toLowerCase());

    saveRecentSearches([question, ...recent].slice(0, MAX_RECENT));

    renderSuggestions();
}


/* Shorter chip text: "What engine is in a 2019 Mustang GT?" -> "2019 Mustang GT" */
function chipLabel(question) {

    return question
        .replace(/^What engine is in (a |the )?/i, "")
        .replace(/^Specs for the /i, "Specs: ")
        .replace(/^I'm considering a (.*?)\. What should I know\?$/i, "Buying: $1")
        .replace(/\?$/, "");
}


function suggestedSearches(recent) {

    const asked = text =>
        recent.some(item => item.toLowerCase() === text.toLowerCase());

    const related = [];

    for (const question of recent.slice(0, 2)) {

        const text = question.toLowerCase();
        const years = extractYears(text).filter(isSupportedYear);
        const trims = extractTrims(text);

        if (years.length !== 1) {
            continue;
        }

        const year = years[0];
        const trim = trims.length === 1 ? trims[0] : null;
        const vehicle = `${year} Mustang${trim ? " " + trim : ""}`;
        const other = trim ? otherTrim(year, trim) : null;

        [
            `Recalls for the ${year} Mustang`,
            `Owner complaints for the ${vehicle}`,
            `Fuel economy for the ${vehicle}`,
            other ? `Compare the ${year} Mustang ${trim} and ${other}` : null
        ]
            .filter(Boolean)
            .filter(item => !asked(item) && !related.includes(item))
            .slice(0, 2)
            .forEach(item => related.push(item));
    }

    const fresh =
        FRESH_SUGGESTIONS.filter(item => !asked(item) && !related.includes(item));

    return [
        ...related.slice(0, 3).map(query => ({ query, related: true })),
        ...fresh.map(query => ({ query, related: false }))
    ].slice(0, 5);
}


function renderSuggestions() {

    const area = document.getElementById("suggestions");

    if (!area) {
        return;
    }

    const recent = loadRecentSearches();

    const chips =
        suggestedSearches(recent)
            .map(item => `
                <button type="button" class="suggest-chip${item.related ? " related" : ""}" data-query="${escapeHtml(item.query)}">
                    ${item.related ? "→" : "+"} ${escapeHtml(chipLabel(item.query))}
                </button>
            `)
            .join("");

    area.innerHTML = `
        <div class="suggest-head">
            <span>Suggested for you</span>
            ${recent.length ? `<button type="button" class="recent-link" id="openRecent">Recent searches (${recent.length})</button>` : ""}
        </div>
        <div class="suggest-row">${chips}</div>
    `;
}


function showRecentDialog() {

    const recent = loadRecentSearches();

    showResult(
        "Recent Searches",
        recent.length
            ? `
                <div class="result-section">
                    <div class="recent-list">
                        ${recent.map(question => `
                            <button type="button" class="recent-item" data-action="run-query" data-query="${escapeHtml(question)}">
                                ${escapeHtml(question)}
                            </button>
                        `).join("")}
                    </div>
                    <p class="note">Saved only in this browser. VINs are never saved.</p>
                    <div class="button-row">
                        <button type="button" class="secondary-button" data-action="clear-recent">Clear history</button>
                    </div>
                </div>
            `
            : sectionHtml("", ["No recent searches. Your searches will appear here."])
    );
}


/* =====================================================
    Pick a Mustang (year, trim and topic)
   ===================================================== */

const PICK_TOPICS = {
    specs: vehicle => `Specs for the ${vehicle}`,
    recalls: (vehicle, year) => `Recalls for the ${year} Mustang`,
    complaints: vehicle => `Owner complaints for the ${vehicle}`,
    fuel: vehicle => `Fuel economy for the ${vehicle}`,
    buying: vehicle => `I'm considering a ${vehicle}. What should I know?`
};

let pickTopic = "specs";


function pickedQuestion() {

    const year = document.getElementById("pickYear").value;
    const trim = document.getElementById("pickTrim").value;

    return PICK_TOPICS[pickTopic](`${year} Mustang${trim ? " " + trim : ""}`, year);
}


function fillPickTrims() {

    const yearSelect = document.getElementById("pickYear");
    const trimSelect = document.getElementById("pickTrim");
    const keep = trimSelect.value;

    const trims = trimsByYear.get(Number(yearSelect.value)) || [];

    trimSelect.innerHTML =
        `<option value="">All trims</option>` +
        trims.map(trim => `<option>${escapeHtml(trim)}</option>`).join("");

    if (trims.includes(keep)) {
        trimSelect.value = keep;
    }

    updatePickPreview();
}


function updatePickPreview() {

    document.getElementById("pickPreview").textContent =
        `Will ask: ${pickedQuestion()}`;
}


async function setupPicker() {

    try {

        for (const vehicle of await loadVehicles()) {

            if (!trimsByYear.has(vehicle.year)) {
                trimsByYear.set(vehicle.year, []);
            }

            trimsByYear.get(vehicle.year).push(vehicle.trim);
        }
    }

    catch (error) {

        console.error(error);

        document.getElementById("pickerCard").hidden = true;

        return;
    }

    const yearSelect = document.getElementById("pickYear");

    yearSelect.innerHTML =
        [...trimsByYear.keys()]
            .sort((a, b) => b - a)
            .map(year => `<option>${year}</option>`)
            .join("");

    fillPickTrims();

    renderSuggestions();
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

        if (button.dataset.action === "run-query") {
            hideResult();
            handleUserRequest(button.dataset.query);
        }

        if (button.dataset.action === "open-vin") {
            showVinDialog();
        }

        if (button.dataset.action === "vin-lookup") {
            submitVinDialog();
        }

        if (button.dataset.action === "open-sticker") {
            showWindowSticker(button.dataset.vin);
        }

        if (button.dataset.action === "back-to-result") {
            restorePreviousResult();
        }

        if (button.dataset.action === "clear-recent") {
            saveRecentSearches([]);
            renderSuggestions();
            showRecentDialog();
        }
    }
);


resultContent.addEventListener("input", event => {

    if (event.target.id === "vinInput") {
        checkVinInput(event.target);
    }
});


resultContent.addEventListener("keydown", event => {

    if (event.target.id === "vinInput" && event.key === "Enter") {
        submitVinDialog();
    }
});


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


document.getElementById("openVinButton").addEventListener("click", showVinDialog);


document.getElementById("suggestions").addEventListener("click", event => {

    if (event.target.closest("#openRecent")) {
        showRecentDialog();

        return;
    }

    const chip = event.target.closest(".suggest-chip");

    if (chip) {
        handleUserRequest(chip.dataset.query);
    }
});


document.getElementById("pickYear").addEventListener("change", fillPickTrims);

document.getElementById("pickTrim").addEventListener("change", updatePickPreview);

document.getElementById("pickTopics").addEventListener("click", event => {

    const button = event.target.closest("[data-topic]");

    if (!button) {
        return;
    }

    pickTopic = button.dataset.topic;

    for (const item of document.querySelectorAll("#pickTopics [data-topic]")) {
        item.setAttribute("aria-pressed", String(item === button));
    }

    updatePickPreview();
});

document.getElementById("pickButton").addEventListener("click", () => handleUserRequest(pickedQuestion()));


renderSuggestions();
setupPicker();
