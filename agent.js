/*
    Torque Intel - agent logic

    This file contains NO page code (no document.getElementById,
    no HTML). That is deliberate: the same guard and coordinator
    are loaded by both the app (index.html) and the evaluation
    runner (eval/index.html).

    Flow:
    User -> Security / Scope Guard -> Coordinating Agent -> tools
*/


/*
    Limits
*/
const MAX_TURNS_PER_SESSION = 10;
const MAX_TOOL_CALLS_PER_TURN = 4;
const MAX_COMPARISON_VEHICLES = 5;
const MAX_RESULTS_PER_TOOL = 10;


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
