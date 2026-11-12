/*
    Torque Intel - tools

    Tools fetch or compute data and RETURN it.
    They never touch the page. app.js decides how to display
    whatever a tool returns.

    Every tool returns the same shape:

        { ok: true,  tool, args, source, data }
        { ok: false, tool, args, source, error }

    Error codes:
        invalid_arguments  the arguments were missing or wrong
        not_found          no vehicle in the dataset matched
        data_unavailable   the local dataset could not be loaded
        network_error      the request never reached the service
        service_error      the service answered with an error
        not_implemented    the tool has no data source yet

    Tools never invent data. If a source has nothing,
    the tool says so.
*/


const TOOL_CONFIG = {

    /* The evaluation page changes this to "../data/vehicles.json". */
    vehicleDataUrl: "data/vehicles.json",

    /*
        Official NHTSA public recalls API. No API key.
        Example:
        https://api.nhtsa.gov/recalls/recallsByVehicle?make=ford&model=mustang&modelYear=2020
    */
    nhtsaRecallsUrl: "https://api.nhtsa.gov/recalls/recallsByVehicle",

    requestTimeoutMs: 10000
};

const SOURCES = {

    localDataset: {
        name: "Torque Intel vehicle dataset",
        url: null
    },

    nhtsa: {
        name: "NHTSA (National Highway Traffic Safety Administration) Recalls API",
        url: "https://www.nhtsa.gov/recalls"
    }
};


/* =====================================================
    Local vehicle dataset
   ===================================================== */

let vehicleCache = null;


/*
    Loads the local vehicle dataset once and remembers it.
    Throws if it cannot be loaded or parsed.
*/
async function loadVehicles() {

    if (vehicleCache) {
        return vehicleCache;
    }

    const response =
        await fetch(TOOL_CONFIG.vehicleDataUrl);

    if (!response.ok) {
        throw new Error(
            "Vehicle data could not be loaded."
        );
    }

    vehicleCache =
        Object.values(await response.json());

    return vehicleCache;
}


/*
    Finds one vehicle in an already-loaded dataset.
    Returns the vehicle, or null. No network, no page code.
*/
function lookupVehicle(
    vehicles,
    { make, model, trim, year }
) {

    const same = (a, b) =>
        String(a).toLowerCase() === String(b).toLowerCase();

    return (
        vehicles.find(
            vehicle =>
                vehicle.year === Number(year) &&
                same(vehicle.make, make) &&
                same(vehicle.model, model) &&
                same(vehicle.trim, trim)
        ) || null
    );
}


/*
    Tool: getVehicleInfo
    args: { make, model, trim, year }
*/
async function getVehicleInfo(args) {

    const base = {
        tool: "getVehicleInfo",
        args,
        source: SOURCES.localDataset
    };

    let vehicles;

    try {
        vehicles = await loadVehicles();
    }

    catch (error) {

        console.error(error);

        return {
            ...base,
            ok: false,
            error: "data_unavailable"
        };
    }


    const vehicle =
        lookupVehicle(vehicles, args);

    if (!vehicle) {

        return {
            ...base,
            ok: false,
            error: "not_found"
        };
    }

    return {
        ...base,
        ok: true,
        data: vehicle
    };
}


/* =====================================================
    NHTSA recalls
   ===================================================== */

/*
    NHTSA sends dates as DD/MM/YYYY.
    Converts to YYYY-MM-DD, or returns null if the
    value is not in that format.
*/
function parseNhtsaDate(value) {

    const match =
        /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || "");

    return match
        ? `${match[3]}-${match[2]}-${match[1]}`
        : null;
}


/*
    Retrieval only: asks NHTSA for the recalls of one
    make / model / model year and returns them unchanged
    apart from renaming the fields.

    Returns { ok: true, count, recalls } or { ok: false, error }.
*/
async function fetchNhtsaRecalls(
    make,
    model,
    modelYear
) {

    const query =
        new URLSearchParams({
            make,
            model,
            modelYear: String(modelYear)
        });

    const url =
        `${TOOL_CONFIG.nhtsaRecallsUrl}?${query}`;


    let response;

    try {

        response =
            await fetch(url, {
                signal: AbortSignal.timeout(
                    TOOL_CONFIG.requestTimeoutMs
                )
            });
    }

    catch (error) {

        console.error(error);

        return {
            ok: false,
            error: "network_error"
        };
    }


    if (!response.ok) {

        return {
            ok: false,
            error: "service_error"
        };
    }


    let body;

    try {
        body = await response.json();
    }

    catch (error) {

        console.error(error);

        return {
            ok: false,
            error: "service_error"
        };
    }


    if (!body || !Array.isArray(body.results)) {

        return {
            ok: false,
            error: "service_error"
        };
    }


    const recalls =
        body.results.map(
            recall => ({
                campaignNumber: recall.NHTSACampaignNumber,
                reportDate: parseNhtsaDate(recall.ReportReceivedDate),
                component: recall.Component,
                summary: recall.Summary,
                consequence: recall.Consequence,
                remedy: recall.Remedy,
                parkIt: recall.parkIt === true,
                parkOutside: recall.parkOutSide === true
            })
        );

    return {
        ok: true,
        count: recalls.length,
        recalls
    };
}


/*
    Tool: getRecalls
    args: { make, model, modelYear }

    Note: NHTSA lists recalls by model, not by trim. Results
    cover the whole model line for that year, and a recall
    may apply to only some vehicles.
*/
async function getRecalls(args) {

    const base = {
        tool: "getRecalls",
        args,
        source: SOURCES.nhtsa
    };

    const { make, model, modelYear } =
        args || {};

    if (
        !make ||
        !model ||
        !/^\d{4}$/.test(String(modelYear))
    ) {

        return {
            ...base,
            ok: false,
            error: "invalid_arguments"
        };
    }


    const result =
        await fetchNhtsaRecalls(
            make,
            model,
            modelYear
        );

    if (!result.ok) {

        return {
            ...base,
            ok: false,
            error: result.error
        };
    }


    /*
        Newest first; recalls without a readable date go last.
    */
    const sorted =
        [...result.recalls].sort(
            (a, b) =>
                (b.reportDate || "").localeCompare(a.reportDate || "")
        );

    return {
        ...base,
        ok: true,
        data: {
            make,
            model,
            modelYear: Number(modelYear),
            totalCount: result.count,
            recalls: sorted.slice(0, MAX_RESULTS_PER_TOOL)
        }
    };
}


/* =====================================================
    Reliability
   ===================================================== */

/*
    Tool: searchReliability
    args: { make, model, trim, year }

    No verified reliability source is connected yet,
    so this tool reports that instead of guessing.
*/
async function searchReliability(args) {

    return {
        ok: false,
        tool: "searchReliability",
        args,
        source: null,
        error: "not_implemented"
    };
}


/* =====================================================
    Comparison
   ===================================================== */

/*
    Tool: compareVehicles
    args: { make, model, trim, years, criteria }

    Must only run after the human gate approves it.

    Returns one row per model year. A value of null means
    "not available"; it is never filled in with a guess.
*/
async function compareVehicles(args) {

    const base = {
        tool: "compareVehicles",
        args,
        source: SOURCES.localDataset
    };

    const { make, model, trim, years, criteria } =
        args || {};

    if (
        !Array.isArray(years) ||
        years.length < 2 ||
        years.length > MAX_COMPARISON_VEHICLES ||
        !Array.isArray(criteria)
    ) {

        return {
            ...base,
            ok: false,
            error: "invalid_arguments"
        };
    }


    let vehicles;

    try {
        vehicles = await loadVehicles();
    }

    catch (error) {

        console.error(error);

        return {
            ...base,
            ok: false,
            error: "data_unavailable"
        };
    }


    const wantsRecalls =
        criteria.includes("recalls");

    const rows =
        await Promise.all(
            years.map(
                async year => {

                    const vehicle =
                        lookupVehicle(
                            vehicles,
                            { make, model, trim, year }
                        );

                    const recallResult =
                        wantsRecalls
                            ? await fetchNhtsaRecalls(make, model, year)
                            : null;

                    return {
                        year,
                        found: vehicle !== null,
                        engine: vehicle ? vehicle.engine : null,
                        horsepower: vehicle ? vehicle.horsepower : null,
                        drivetrain: vehicle ? vehicle.drivetrain : null,
                        transmissions: vehicle ? vehicle.transmissions : null,
                        recallCount:
                            recallResult && recallResult.ok
                                ? recallResult.count
                                : null,
                        reliability: null
                    };
                }
            )
        );

    return {
        ...base,
        ok: true,
        data: {
            make,
            model,
            trim,
            criteria,
            rows,
            recallSource: wantsRecalls ? SOURCES.nhtsa : null
        }
    };
}


/*
    Tool registry: lets the app run a tool by its name.
*/
const TOOLS = {
    getVehicleInfo,
    getRecalls,
    searchReliability,
    compareVehicles
};
