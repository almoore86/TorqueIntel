/*
    Torque Intel - tools

    Tools fetch or compute data and RETURN it.
    They never touch the page. app.js decides how to display
    whatever a tool returns.

    Every tool returns the same shape:

        { ok: true,  tool: "name", data: ... }
        { ok: false, tool: "name", error: "error_code" }

    Error codes:
        not_found          no supported vehicle matched
        data_unavailable   the dataset is missing, empty, or invalid
        not_implemented    the tool is a placeholder
*/


const VEHICLE_DATA_URL = "data/vehicles.json";


/*
    Loads the local vehicle dataset.
    Throws if it cannot be loaded or parsed.
*/
async function loadVehicles() {

    const response =
        await fetch(VEHICLE_DATA_URL);

    if (!response.ok) {
        throw new Error(
            "Vehicle data could not be loaded."
        );
    }

    return Object.values(
        await response.json()
    );
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


    for (const vehicle of vehicles) {

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
    Tool: getVehicleInfo
*/
async function getVehicleInfo(question) {

    const tool = "getVehicleInfo";

    let vehicles;

    try {
        vehicles = await loadVehicles();
    }

    catch (error) {

        console.error(error);

        return {
            ok: false,
            tool,
            error: "data_unavailable"
        };
    }


    const vehicle =
        identifyVehicle(
            question,
            vehicles
        );


    if (!vehicle) {

        return {
            ok: false,
            tool,
            error: "not_found"
        };
    }


    return {
        ok: true,
        tool,
        data: vehicle
    };
}


/*
    Tool: getRecalls (placeholder)
*/
async function getRecalls(question) {

    return {
        ok: false,
        tool: "getRecalls",
        error: "not_implemented"
    };
}


/*
    Tool: searchReliability (placeholder)
*/
async function searchReliability(question) {

    return {
        ok: false,
        tool: "searchReliability",
        error: "not_implemented"
    };
}


/*
    Tool: compareVehicles (placeholder)
    Must only run after the human gate approves it.
*/
async function compareVehicles(vehicles) {

    return {
        ok: false,
        tool: "compareVehicles",
        error: "not_implemented"
    };
}
