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


const MAX_TOOL_CALLS_PER_TURN = 4;
const MAX_TURNS_PER_SESSION = 10;

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


    const securityResult =
        checkRequestSafety(question);


    if (!securityResult.allowed) {

        showResult(
            "Request Not Available",
            `
            <div class="result-section">
                <p>${securityResult.message}</p>
            </div>
            `
        );

        statusArea.textContent = "";

        return;
    }


    const intent =
        coordinateRequest(question);


    await routeRequest(
        intent,
        securityResult.safeQuestion
    );
}


/*
    Security / Scope Guard
*/
function checkRequestSafety(question) {

    const lowerQuestion =
        question.toLowerCase();


    const protectedRequests = [
        "api key",
        "password",
        "credentials",
        "environment variable",
        "system prompt",
        "hidden instruction",
        "secret key",
        "private configuration"
    ];


    const containsProtectedRequest =
        protectedRequests.some(
            phrase =>
                lowerQuestion.includes(phrase)
        );


    if (containsProtectedRequest) {

        return {
            allowed: false,

            message:
                "Torque Intel cannot provide credentials, private configuration, system instructions, or protected application information."
        };
    }


    const automotiveTerms = [
        "car",
        "vehicle",
        "ford",
        "mustang",
        "engine",
        "transmission",
        "horsepower",
        "recall",
        "reliability",
        "buy",
        "buying",
        "model",
        "drivetrain"
    ];


    const appearsAutomotive =
        automotiveTerms.some(
            term =>
                lowerQuestion.includes(term)
        );


    if (!appearsAutomotive) {

        return {
            allowed: false,

            message:
                "Torque Intel is designed for automotive research, vehicle specifications, reliability, recalls, and vehicle comparisons."
        };
    }


    return {
        allowed: true,
        safeQuestion: question
    };
}


/*
    Coordinating Agent
    Determines what kind of automotive
    request the user is making.
*/
function coordinateRequest(question) {

    const text =
        question.toLowerCase();


    if (
        text.includes("compare") ||
        text.includes("versus") ||
        text.includes(" vs ")
    ) {
        return "vehicle_comparison";
    }


    if (
        text.includes("recall") ||
        text.includes("recalled")
    ) {
        return "recall_lookup";
    }


    if (
        text.includes("reliable") ||
        text.includes("reliability") ||
        text.includes("problem") ||
        text.includes("issue")
    ) {
        return "reliability_research";
    }


    return "vehicle_information";
}


/*
    Routes the request to the correct tool.
*/
async function routeRequest(
    intent,
    question
) {

    switch (intent) {

        case "vehicle_information":

            await runVehicleInformationTool(
                question
            );

            break;


        case "reliability_research":

            showResult(
                "Reliability Research",
                `
                <div class="result-section">
                    <p>
                        Torque Intel identified this as
                        a reliability research request.
                    </p>
                    <p>
                        The reliability tool will be
                        connected next.
                    </p>
                </div>
                `
            );

            break;


        case "recall_lookup":

            showResult(
                "Recall Research",
                `
                <div class="result-section">
                    <p>
                        Torque Intel identified this as
                        a recall request.
                    </p>
                    <p>
                        The live NHTSA recall tool will
                        be connected next.
                    </p>
                </div>
                `
            );

            break;


        case "vehicle_comparison":

            showComparisonApproval(
                question
            );

            break;


        default:

            showResult(
                "Request",
                `
                <p>
                    Torque Intel could not determine
                    which automotive tool should be used.
                </p>
                `
            );
    }


    statusArea.textContent = "";
}


/*
    Vehicle Information Tool
*/
async function runVehicleInformationTool(
    question
) {

    try {

        const response =
            await fetch(
                "data/vehicles.json"
            );


        if (!response.ok) {
            throw new Error(
                "Vehicle data could not be loaded."
            );
        }


        const vehicles =
            await response.json();


        const vehicle =
            identifyVehicle(
                question,
                vehicles
            );


        if (!vehicle) {

            showResult(
                "Vehicle Not Found",
                `
                <div class="result-section">
                    <p>
                        Torque Intel could not match
                        that request to a supported
                        vehicle yet.
                    </p>
                    <p>
                        The current prototype focuses
                        on selected Ford Mustang GT
                        model years.
                    </p>
                </div>
                `
            );

            return;
        }


        displayVehicleInformation(
            vehicle
        );

    }

    catch (error) {

        showResult(
            "Vehicle Data Error",
            `
            <div class="result-section">
                <p>
                    Torque Intel could not access
                    the local vehicle dataset.
                </p>
            </div>
            `
        );


        console.error(error);
    }
}


/*
    Matches a user's question
    to the local vehicle dataset.
*/
function identifyVehicle(
    question,
    vehicles
) {

    const text =
        question.toLowerCase();


    for (
        const vehicle of
        Object.values(vehicles)
    ) {

        const yearFound =
            text.includes(
                String(vehicle.year)
            );


        const modelFound =
            text.includes(
                vehicle.model.toLowerCase()
            );


        const trimFound =
            text.includes(
                vehicle.trim.toLowerCase()
            );


        if (
            yearFound &&
            modelFound &&
            trimFound
        ) {
            return vehicle;
        }
    }


    return null;
}


/*
    Formats vehicle tool results.
*/
function displayVehicleInformation(
    vehicle
) {

    const transmissionText =
        vehicle.transmissions.join(", ");


    const html = `
        <div class="result-section">
            <h3>
                ${vehicle.year}
                ${vehicle.make}
                ${vehicle.model}
                ${vehicle.trim}
            </h3>
            <div class="result-grid">
                <div class="result-item">
                    <span class="result-label">
                        Engine
                    </span>
                    ${vehicle.engine}
                </div>
                <div class="result-item">
                    <span class="result-label">
                        Horsepower
                    </span>
                    ${vehicle.horsepower} hp
                </div>
                <div class="result-item">
                    <span class="result-label">
                        Drivetrain
                    </span>
                    ${vehicle.drivetrain}
                </div>
                <div class="result-item">
                    <span class="result-label">
                        Transmission Options
                    </span>
                    ${transmissionText}
                </div>
            </div>
        </div>
    `;


    showResult(
        "Vehicle Information",
        html
    );
}


/*
    Human Gate placeholder.
*/
function showComparisonApproval(
    question
) {

    const html = `
        <div class="result-section">
            <h3>
                Approval Required
            </h3>
            <p>
                Torque Intel selected a
                comparison action.
            </p>
            <div class="result-item">
                <span class="result-label">
                    Tool
                </span>
                compareVehicles
            </div>
            <div class="result-item">
                <span class="result-label">
                    User Request
                </span>
                ${escapeHtml(question)}
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
}


/*
    Basic HTML escaping
    for user-provided text.
*/
function escapeHtml(text) {

    return text
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
    () => {

        resultModal.classList.add(
            "hidden"
        );
    }
);


resultModal.addEventListener(
    "click",
    event => {

        if (
            event.target === resultModal
        ) {

            resultModal.classList.add(
                "hidden"
            );
        }
    }
);
