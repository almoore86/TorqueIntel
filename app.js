/*
    Torque Intel - page logic

    This file owns everything the user sees: reading the
    question, calling the agent (agent.js), running tools
    (tools.js), and showing results in the modal.

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

        const securityResult =
            checkRequestSafety(question);


        if (!securityResult.allowed) {

            showMessage(
                "Request Not Available",
                [securityResult.message]
            );

            return;
        }


        const intent =
            coordinateRequest(question);


        await routeRequest(
            intent,
            securityResult.safeQuestion
        );
    }

    finally {

        statusArea.textContent = "";

        analyzeButton.disabled = false;
    }
}


/*
    Runs the tool for an intent,
    then hands the result to the display code.
*/
async function routeRequest(
    intent,
    question
) {

    switch (intent) {

        case "vehicle_information":

            displayToolResult(
                await getVehicleInfo(question)
            );

            break;


        case "reliability_research":

            displayToolResult(
                await searchReliability(question)
            );

            break;


        case "recall_lookup":

            displayToolResult(
                await getRecalls(question)
            );

            break;


        case "vehicle_comparison":

            /*
                compareVehicles is NOT called here.
                It may only run after human approval.
            */
            showComparisonApproval(question);

            break;


        default:

            showMessage(
                "Request",
                [
                    "Torque Intel could not determine which automotive tool should be used."
                ]
            );
    }
}


/*
    Display: chooses how to show a tool result.
*/
function displayToolResult(result) {

    if (result.ok) {

        if (result.tool === "getVehicleInfo") {
            displayVehicleInformation(result.data);
        }

        return;
    }


    if (result.error === "not_found") {

        showMessage(
            "Vehicle Not Found",
            [
                "Torque Intel could not match that request to a supported vehicle yet.",
                "The current prototype covers the Ford Mustang GT, model years 2015 through 2023. Include the year, for example: 2020 Mustang GT."
            ]
        );

        return;
    }


    if (result.error === "data_unavailable") {

        showMessage(
            "Vehicle Data Error",
            [
                "Torque Intel could not access the local vehicle dataset."
            ]
        );

        return;
    }


    const placeholders = {

        getRecalls: [
            "Recall Research",
            "Torque Intel identified this as a recall request.",
            "The live NHTSA recall tool will be connected next."
        ],

        searchReliability: [
            "Reliability Research",
            "Torque Intel identified this as a reliability research request.",
            "The reliability tool will be connected next."
        ]
    };

    const [title, ...paragraphs] =
        placeholders[result.tool] ||
        ["Tool Not Available", "This tool is not available yet."];

    showMessage(title, paragraphs);
}


/*
    Display: vehicle specifications.
*/
function displayVehicleInformation(
    vehicle
) {

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

    const html = `
        <div class="result-section">
            <h3>${escapeHtml(heading)}</h3>
            <div class="result-grid">
                ${items.map(resultItemHtml).join("")}
            </div>
        </div>
    `;

    showResult(
        "Vehicle Information",
        html
    );
}


/*
    Display: Human Gate placeholder.
*/
function showComparisonApproval(
    question
) {

    const html = `
        <div class="result-section">
            <h3>Approval Required</h3>
            <p>
                Torque Intel selected a
                comparison action.
            </p>
            <div class="result-stack">
                ${resultItemHtml(["Tool", "compareVehicles"])}
                ${resultItemHtml(["User Request", question])}
            </div>
            <p>
                The full comparison arguments
                will be added when the comparison
                tool is implemented.
            </p>
        </div>
    `;

    showResult(
        "Torque Intel Action Request",
        html
    );
}


/*
    Display helpers
*/
function resultItemHtml([label, value]) {

    return `
        <div class="result-item">
            <span class="result-label">${escapeHtml(label)}</span>
            ${escapeHtml(value)}
        </div>
    `;
}


function showMessage(
    title,
    paragraphs
) {

    const html = `
        <div class="result-section">
            ${paragraphs
                .map(text => `<p>${escapeHtml(text)}</p>`)
                .join("")}
        </div>
    `;

    showResult(title, html);
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


function hideResult() {

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


/*
    Event listeners
*/
analyzeButton.addEventListener(
    "click",
    handleUserRequest
);


closeModal.addEventListener(
    "click",
    hideResult
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
