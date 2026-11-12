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

    A tool call can cover several model years. Each year
    reports its own success or failure.

    Tools never invent data. If a source has nothing,
    the tool says so.
*/


const TOOL_CONFIG = {

    /* The evaluation page changes this to "../data/vehicles.json". */
    vehicleDataUrl: "data/vehicles.json",

    /*
        Official NHTSA public APIs. No API key.
        Examples:
        https://api.nhtsa.gov/recalls/recallsByVehicle?make=ford&model=mustang&modelYear=2020
        https://api.nhtsa.gov/complaints/complaintsByVehicle?make=ford&model=mustang&modelYear=2020
    */
    nhtsaRecallsUrl: "https://api.nhtsa.gov/recalls/recallsByVehicle",
    nhtsaComplaintsUrl: "https://api.nhtsa.gov/complaints/complaintsByVehicle",

    requestTimeoutMs: 15000
};

const SOURCES = {

    localDataset: {
        name: "Torque Intel vehicle dataset",
        url: null
    },

    nhtsaRecalls: {
        name: "NHTSA (National Highway Traffic Safety Administration) Recalls API",
        url: "https://www.nhtsa.gov/recalls"
    },

    nhtsaComplaints: {
        name: "NHTSA (National Highway Traffic Safety Administration) Complaints API",
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
    Finds vehicles in an already-loaded dataset.
    No network, no page code.

    trims = []  means every trim offered in those years.

    Returns:
        vehicles   matching entries, by year
        missing    requested { year, trim } pairs (or { year })
                   that have no entry in the dataset
*/
function findVehicles(
    vehicles,
    { make, model, trims, years }
) {

    const same = (a, b) =>
        String(a).toLowerCase() === String(b).toLowerCase();

    const found = [];
    const missing = [];

    for (const year of years) {

        const forYear =
            vehicles.filter(
                vehicle =>
                    vehicle.year === Number(year) &&
                    same(vehicle.make, make) &&
                    same(vehicle.model, model)
            );

        if (!trims || trims.length === 0) {

            if (forYear.length === 0) {
                missing.push({ year });
            }

            found.push(...forYear);

            continue;
        }

        for (const trim of trims) {

            const vehicle =
                forYear.find(
                    candidate =>
                        same(candidate.trim, trim)
                );

            if (vehicle) {
                found.push(vehicle);
            }

            else {
                missing.push({ year, trim });
            }
        }
    }

    return {
        vehicles: found,
        missing
    };
}


/*
    Tool: getVehicleInfo
    args: { make, model, trims, years }
*/
async function getVehicleInfo(args) {

    const base = {
        tool: "getVehicleInfo",
        args,
        source: SOURCES.localDataset
    };

    if (!args || !Array.isArray(args.years) || args.years.length === 0) {

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


    const result =
        findVehicles(vehicles, args);

    if (result.vehicles.length === 0) {

        return {
            ...base,
            ok: false,
            error: "not_found",
            data: result
        };
    }

    return {
        ...base,
        ok: true,
        data: result
    };
}


/* =====================================================
    NHTSA retrieval (shared by recalls and complaints)
   ===================================================== */

/*
    Successful NHTSA answers are remembered for the session,
    so asking about the same year twice does not download
    it again. Failures are never remembered.
*/
const nhtsaCache = new Map();


/*
    Converts an NHTSA date to YYYY-MM-DD.
    Recalls use DD/MM/YYYY; complaints use MM/DD/YYYY.
    Returns null if the value is not in the expected format.
*/
function parseNhtsaDate(value, order) {

    const match =
        /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || "");

    if (!match) {
        return null;
    }

    const [, first, second, year] = match;

    return order === "DMY"
        ? `${year}-${second}-${first}`
        : `${year}-${first}-${second}`;
}


/*
    Asks one NHTSA endpoint for one make / model / model year.
    Returns { ok: true, results } or { ok: false, error }.
*/
async function fetchNhtsaResults(
    baseUrl,
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
        `${baseUrl}?${query}`;

    if (nhtsaCache.has(url)) {
        return nhtsaCache.get(url);
    }


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


    let body = null;

    if (response.ok) {

        try {
            body = await response.json();
        }

        catch (error) {
            console.error(error);
        }
    }

    if (!body || !Array.isArray(body.results)) {

        return {
            ok: false,
            error: "service_error"
        };
    }


    const result = {
        ok: true,
        results: body.results
    };

    nhtsaCache.set(url, result);

    return result;
}


async function fetchNhtsaRecalls(make, model, modelYear) {

    const result =
        await fetchNhtsaResults(
            TOOL_CONFIG.nhtsaRecallsUrl,
            make,
            model,
            modelYear
        );

    if (!result.ok) {
        return result;
    }

    const recalls =
        result.results
            .map(
                recall => ({
                    campaignNumber: recall.NHTSACampaignNumber,
                    reportDate: parseNhtsaDate(recall.ReportReceivedDate, "DMY"),
                    component: recall.Component,
                    summary: recall.Summary,
                    consequence: recall.Consequence,
                    remedy: recall.Remedy,
                    parkIt: recall.parkIt === true,
                    parkOutside: recall.parkOutSide === true
                })
            )
            .sort(newestFirst("reportDate"));

    return {
        ok: true,
        count: recalls.length,
        recalls
    };
}


async function fetchNhtsaComplaints(make, model, modelYear) {

    const result =
        await fetchNhtsaResults(
            TOOL_CONFIG.nhtsaComplaintsUrl,
            make,
            model,
            modelYear
        );

    if (!result.ok) {
        return result;
    }

    const complaints =
        result.results
            .map(
                complaint => ({
                    odiNumber: complaint.odiNumber,
                    dateFiled: parseNhtsaDate(complaint.dateComplaintFiled, "MDY"),
                    components: complaint.components,
                    summary: complaint.summary,
                    crash: complaint.crash === true,
                    fire: complaint.fire === true,
                    injuries: Number(complaint.numberOfInjuries) || 0,
                    deaths: Number(complaint.numberOfDeaths) || 0
                })
            )
            .sort(newestFirst("dateFiled"));

    return {
        ok: true,
        count: complaints.length,
        complaints
    };
}


/*
    Sort helper: newest date first; items without a
    readable date go last.
*/
function newestFirst(field) {

    return (a, b) =>
        (b[field] || "").localeCompare(a[field] || "");
}


/*
    Shares MAX_RESULTS_PER_TOOL between the requested years,
    with at least one result per year.
*/
function resultsPerYear(yearCount) {

    return Math.max(
        1,
        Math.floor(MAX_RESULTS_PER_TOOL / yearCount)
    );
}


function validModelYears(modelYears) {

    return (
        Array.isArray(modelYears) &&
        modelYears.length > 0 &&
        modelYears.every(year => /^\d{4}$/.test(String(year)))
    );
}


/* =====================================================
    Recalls
   ===================================================== */

/*
    Tool: getRecalls
    args: { make, model, modelYears }

    data.years holds one entry per model year:
        { modelYear, ok: true,  totalCount, recalls }
        { modelYear, ok: false, error }

    Note: NHTSA lists recalls by model, not by trim. Results
    cover the whole model line for that year, and a recall
    may apply to only some vehicles.
*/
async function getRecalls(args) {

    const base = {
        tool: "getRecalls",
        args,
        source: SOURCES.nhtsaRecalls
    };

    const { make, model, modelYears } =
        args || {};

    if (!make || !model || !validModelYears(modelYears)) {

        return {
            ...base,
            ok: false,
            error: "invalid_arguments"
        };
    }


    const limit =
        resultsPerYear(modelYears.length);

    const years =
        await Promise.all(
            modelYears.map(
                async modelYear => {

                    const result =
                        await fetchNhtsaRecalls(make, model, modelYear);

                    return result.ok
                        ? {
                            modelYear,
                            ok: true,
                            totalCount: result.count,
                            recalls: result.recalls.slice(0, limit)
                        }
                        : {
                            modelYear,
                            ok: false,
                            error: result.error
                        };
                }
            )
        );

    return {
        ...base,
        ok: true,
        data: { make, model, years }
    };
}


/* =====================================================
    Reliability
   ===================================================== */

/*
    Counts how often each component is named.
    One complaint can name several components.
*/
function countComponents(complaints) {

    const counts = new Map();

    for (const complaint of complaints) {

        const names =
            String(complaint.components || "")
                .split(",")
                .map(name => name.trim())
                .filter(Boolean);

        for (const name of new Set(names)) {
            counts.set(name, (counts.get(name) || 0) + 1);
        }
    }

    return [...counts]
        .map(([component, count]) => ({ component, count }))
        .sort(
            (a, b) =>
                b.count - a.count ||
                a.component.localeCompare(b.component)
        );
}


/*
    Tool: searchReliability
    args: { make, model, modelYears }

    Reports the owner complaints filed publicly with NHTSA.
    It only counts and quotes what NHTSA holds. It does not
    produce a reliability score.

    data.years holds one entry per model year:
        {
            modelYear, ok: true,
            totalCount, crashCount, fireCount, injuries, deaths,
            topComponents: [{ component, count }],
            recentComplaints: [...]
        }
        { modelYear, ok: false, error }

    Note: complaints are owner reports that NHTSA publishes
    without verifying each one, and they are listed by model,
    not by trim.
*/
async function searchReliability(args) {

    const base = {
        tool: "searchReliability",
        args,
        source: SOURCES.nhtsaComplaints
    };

    const { make, model, modelYears } =
        args || {};

    if (!make || !model || !validModelYears(modelYears)) {

        return {
            ...base,
            ok: false,
            error: "invalid_arguments"
        };
    }


    const limit =
        resultsPerYear(modelYears.length);

    const sum = (items, field) =>
        items.reduce((total, item) => total + item[field], 0);

    const years =
        await Promise.all(
            modelYears.map(
                async modelYear => {

                    const result =
                        await fetchNhtsaComplaints(make, model, modelYear);

                    if (!result.ok) {

                        return {
                            modelYear,
                            ok: false,
                            error: result.error
                        };
                    }

                    const { complaints } = result;

                    return {
                        modelYear,
                        ok: true,
                        totalCount: result.count,
                        crashCount: complaints.filter(item => item.crash).length,
                        fireCount: complaints.filter(item => item.fire).length,
                        injuries: sum(complaints, "injuries"),
                        deaths: sum(complaints, "deaths"),
                        topComponents: countComponents(complaints).slice(0, 5),
                        recentComplaints: complaints.slice(0, limit)
                    };
                }
            )
        );

    return {
        ...base,
        ok: true,
        data: { make, model, years }
    };
}


/* =====================================================
    Comparison
   ===================================================== */

/*
    Tool: compareVehicles
    args: { make, model, trims, years, criteria }

    Must only run after the human gate approves it.

    Returns one row per year and trim. A value of null means
    "not available"; it is never filled in with a guess.
    Recall and complaint counts are per model year, because
    NHTSA does not separate them by trim.
*/
async function compareVehicles(args) {

    const base = {
        tool: "compareVehicles",
        args,
        source: SOURCES.localDataset
    };

    const { make, model, trims, years, criteria } =
        args || {};

    const vehicleCount =
        Array.isArray(years) && Array.isArray(trims)
            ? years.length * trims.length
            : 0;

    if (
        vehicleCount < 2 ||
        vehicleCount > MAX_COMPARISON_VEHICLES ||
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

    const wantsComplaints =
        criteria.includes("reliability");

    /* One NHTSA lookup per year, shared by every trim. */
    const countsByYear = new Map();

    await Promise.all(
        years.map(
            async year => {

                const [recalls, complaints] =
                    await Promise.all([
                        wantsRecalls
                            ? fetchNhtsaRecalls(make, model, year)
                            : null,
                        wantsComplaints
                            ? fetchNhtsaComplaints(make, model, year)
                            : null
                    ]);

                countsByYear.set(year, {
                    recallCount:
                        recalls && recalls.ok ? recalls.count : null,
                    complaintCount:
                        complaints && complaints.ok ? complaints.count : null
                });
            }
        )
    );


    const rows = [];

    for (const year of years) {

        for (const trim of trims) {

            const vehicle =
                findVehicles(
                    vehicles,
                    { make, model, trims: [trim], years: [year] }
                ).vehicles[0] || null;

            rows.push({
                year,
                trim,
                found: vehicle !== null,
                engine: vehicle ? vehicle.engine : null,
                horsepower: vehicle ? vehicle.horsepower : null,
                drivetrain: vehicle ? vehicle.drivetrain : null,
                transmissions: vehicle ? vehicle.transmissions : null,
                ...countsByYear.get(year)
            });
        }
    }

    return {
        ...base,
        ok: true,
        data: {
            make,
            model,
            criteria,
            rows,
            otherSources: [
                wantsRecalls ? SOURCES.nhtsaRecalls : null,
                wantsComplaints ? SOURCES.nhtsaComplaints : null
            ].filter(Boolean)
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
