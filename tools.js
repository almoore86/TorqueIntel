/*
    TorqueIntel - tools

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

    /*
        NHTSA's public VIN decoder (vPIC). No API key.
        https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/<VIN>?format=json
    */
    nhtsaVinDecoderUrl: "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/",

    /*
        U.S. EPA fuel economy data (fueleconomy.gov). No API key.
        https://www.fueleconomy.gov/ws/rest/vehicle/menu/model?year=2019&make=Ford
    */
    fuelEconomyUrl: "https://www.fueleconomy.gov/ws/rest/vehicle/",

    /*
        NHTSA is sometimes slow for a moment. Each request gets
        requestTimeoutMs to answer; if it times out, cannot be
        reached, or NHTSA reports a temporary server error, it
        is tried again (up to maxAttempts in total), waiting
        retryDelaysMs between tries. Worst case is about 27
        seconds before the app says NHTSA could not be reached.
    */
    requestTimeoutMs: 8000,
    maxAttempts: 3,
    retryDelaysMs: [1000, 2000]
};

const SOURCES = {

    localDataset: {
        name: "TorqueIntel vehicle dataset",
        url: null
    },

    nhtsaRecalls: {
        name: "NHTSA (National Highway Traffic Safety Administration) Recalls API",
        url: "https://www.nhtsa.gov/recalls"
    },

    nhtsaComplaints: {
        name: "NHTSA (National Highway Traffic Safety Administration) Complaints API",
        url: "https://www.nhtsa.gov/recalls"
    },

    nhtsaVinDecoder: {
        name: "NHTSA vPIC VIN decoder",
        url: "https://vpic.nhtsa.dot.gov/"
    },

    fuelEconomy: {
        name: "U.S. EPA fuel economy ratings (fueleconomy.gov)",
        url: "https://www.fueleconomy.gov/"
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
    Fetches JSON from an NHTSA service, retrying temporary
    failures (see TOOL_CONFIG). Returns { ok: true, body }
    or { ok: false, error } with error "network_error" or
    "service_error".

    Retried: timeouts, network failures, HTTP 429 and 5xx,
    and answers that are not valid JSON.
    Not retried: other HTTP errors such as 400 or 403, which
    would fail the same way again.
*/
async function fetchJsonWithRetry(url, headers = {}) {

    const wait = ms =>
        new Promise(resolve => setTimeout(resolve, ms));

    let lastError = "network_error";

    for (let attempt = 1; attempt <= TOOL_CONFIG.maxAttempts; attempt++) {

        if (attempt > 1) {
            await wait(TOOL_CONFIG.retryDelaysMs[attempt - 2] ?? 2000);
        }

        let response;

        try {

            response =
                await fetch(url, {
                    headers,
                    signal: AbortSignal.timeout(
                        TOOL_CONFIG.requestTimeoutMs
                    )
                });
        }

        catch (error) {

            console.error(`NHTSA attempt ${attempt} failed:`, error);

            lastError = "network_error";

            continue;
        }


        if (!response.ok) {

            lastError = "service_error";

            if (response.status === 429 || response.status >= 500) {
                continue;
            }

            return {
                ok: false,
                error: "service_error"
            };
        }


        try {

            return {
                ok: true,
                body: await response.json()
            };
        }

        catch (error) {

            console.error(`NHTSA attempt ${attempt} returned invalid JSON:`, error);

            lastError = "service_error";
        }
    }

    return {
        ok: false,
        error: lastError
    };
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


    const response =
        await fetchJsonWithRetry(url);

    if (!response.ok) {
        return response;
    }

    const body =
        response.body;

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
    VIN recalls
   ===================================================== */

/*
    Asks NHTSA's VIN decoder what vehicle a VIN belongs to.
    Returns { ok: true, vehicle } or { ok: false, error }.
    Only fields NHTSA filled in are kept; nothing is guessed.
*/
async function decodeVin(vin) {

    const response =
        await fetchJsonWithRetry(
            `${TOOL_CONFIG.nhtsaVinDecoderUrl}${encodeURIComponent(vin)}?format=json`
        );

    if (!response.ok) {
        return response;
    }

    const body =
        response.body;

    const row =
        body && Array.isArray(body.Results)
            ? body.Results[0]
            : null;

    if (!row) {

        return {
            ok: false,
            error: "service_error"
        };
    }


    const text = value =>
        typeof value === "string" && value.trim()
            ? value.trim()
            : null;

    /* "FORD" -> "Ford", "FLAT ROCK" -> "Flat Rock" */
    const titleCase = value =>
        value
            ? value.toLowerCase().replace(/(^|[\s-])\w/g, letter => letter.toUpperCase())
            : null;

    const year =
        Number(row.ModelYear) || null;

    if (!year || !text(row.Make) || !text(row.Model)) {

        return {
            ok: false,
            error: "vin_not_decoded"
        };
    }

    const displacement =
        Number(row.DisplacementL);

    const engine =
        [
            displacement ? `${displacement.toFixed(1)}L` : null,
            text(row.EngineCylinders) ? `${text(row.EngineCylinders)}-cylinder` : null
        ]
            .filter(Boolean)
            .join(" ") || null;

    const plant =
        [
            titleCase(text(row.PlantCity)),
            titleCase(text(row.PlantState))
        ]
            .filter(Boolean)
            .join(", ") || null;

    return {
        ok: true,
        vehicle: {
            year,
            make: titleCase(text(row.Make)),
            model: text(row.Model),
            trim: text(row.Trim),
            bodyClass: text(row.BodyClass),
            engine,
            driveType: text(row.DriveType),
            plant
        }
    };
}


/*
    Tool: getVinRecalls
    args: { vin }

    1. Asks NHTSA's VIN decoder which vehicle the VIN is.
    2. If it is a 2015-2023 Ford Mustang, looks up NHTSA's
       recalls for that model year.

    data:
        {
            vin,
            vehicle: { year, make, model, trim, bodyClass,
                       engine, driveType, plant },
            recalls: { ok: true, totalCount, recalls }
                   | { ok: false, error }
        }

    Important: NHTSA's public recall API lists recalls by
    model year, not by VIN. These are every recall for that
    model year; they cannot say which apply to this exact car
    or whether they have been repaired. NHTSA's own VIN check
    at nhtsa.gov/recalls can, but it has no public API.

    Extra error codes:
        vin_not_decoded       NHTSA could not identify the VIN
        unsupported_vehicle   the VIN is not a 2015-2023 Mustang
                              (data.vehicle says what it is)
*/
async function getVinRecalls(args) {

    const base = {
        tool: "getVinRecalls",
        args,
        source: SOURCES.nhtsaVinDecoder
    };

    const vin =
        args && typeof args.vin === "string"
            ? args.vin.toUpperCase()
            : "";

    if (!isValidVin(vin)) {

        return {
            ...base,
            ok: false,
            error: "invalid_arguments"
        };
    }


    const decoded =
        await decodeVin(vin);

    if (!decoded.ok) {

        return {
            ...base,
            ok: false,
            error: decoded.error,
            data: { vin }
        };
    }

    const { vehicle } =
        decoded;

    const same = (a, b) =>
        String(a).toLowerCase() === String(b).toLowerCase();

    const supported =
        same(vehicle.make, SUPPORTED_VEHICLE.make) &&
        same(vehicle.model, SUPPORTED_VEHICLE.model) &&
        isSupportedYear(vehicle.year);

    if (!supported) {

        return {
            ...base,
            ok: false,
            error: "unsupported_vehicle",
            data: { vin, vehicle }
        };
    }


    const recalls =
        await fetchNhtsaRecalls(
            SUPPORTED_VEHICLE.make,
            SUPPORTED_VEHICLE.model,
            vehicle.year
        );

    return {
        ...base,
        ok: true,
        data: {
            vin,
            vehicle,
            recalls: recalls.ok
                ? {
                    ok: true,
                    totalCount: recalls.count,
                    recalls: recalls.recalls.slice(0, MAX_RESULTS_PER_TOOL)
                }
                : {
                    ok: false,
                    error: recalls.error
                },
            otherSources: [SOURCES.nhtsaRecalls]
        }
    };
}


/* =====================================================
    Fuel economy
   ===================================================== */

/*
    How each TorqueIntel trim appears in the EPA's data.
    The EPA names Mustangs by model ("Mustang", "Mustang
    Bullitt", "Shelby GT350 Mustang") and engine, not by
    trim, so the base trims are told apart by engine size.
    The EPA does not list the GT350R separately.
*/
const EPA_TRIMS = {
    "V6": { models: ["Mustang", "Mustang Convertible"], liters: "3.7" },
    "EcoBoost": {
        models: ["Mustang", "Mustang Convertible", "Mustang Performance Package", "Mustang HO Coupe", "Mustang HO Convertible"],
        liters: "2.3"
    },
    "GT": { models: ["Mustang", "Mustang Convertible", "Mustang Performance Package"], liters: "5.0" },
    "Bullitt": { models: ["Mustang Bullitt"] },
    "Mach 1": { models: ["Mustang Mach 1"] },
    "Shelby GT350": { models: ["Shelby GT350 Mustang"] },
    "Shelby GT500": { models: ["Shelby GT500 Mustang"] }
};

const EPA_JSON = { Accept: "application/json" };

const epaCache = new Map();


/* Cached GET of one fueleconomy.gov JSON resource. */
async function fetchEpa(path) {

    const url =
        `${TOOL_CONFIG.fuelEconomyUrl}${path}`;

    if (epaCache.has(url)) {
        return epaCache.get(url);
    }

    const response =
        await fetchJsonWithRetry(url, EPA_JSON);

    if (response.ok) {
        epaCache.set(url, response);
    }

    return response;
}


/* The EPA returns one item as an object and several as a list. */
function asList(value) {

    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
}


/*
    Tool: getFuelEconomy
    args: { make, model, trims, years }

    trims = [] means every trim offered in those years.

    data.years holds one entry per model year:
        {
            year, ok: true,
            configurations: [{ trim, epaModel, description,
                               transmission, city, highway,
                               combined, fuel, epaUrl }],
            missing: [{ trim, reason }]
        }
        { year, ok: false, error }

    Ratings are the EPA's; nothing is estimated.
*/
async function getFuelEconomy(args) {

    const base = {
        tool: "getFuelEconomy",
        args,
        source: SOURCES.fuelEconomy
    };

    const { years, trims } =
        args || {};

    if (!Array.isArray(years) || years.length === 0) {

        return {
            ...base,
            ok: false,
            error: "invalid_arguments"
        };
    }


    let vehicles = [];

    try {
        vehicles = await loadVehicles();
    }

    catch (error) {
        console.error(error);
    }


    /* Step 1: find matching EPA configurations (cheap menu calls). */
    const perYear =
        await Promise.all(
            years.map(async year => {

                const wanted =
                    trims && trims.length
                        ? trims
                        : vehicles
                            .filter(vehicle => vehicle.year === Number(year))
                            .map(vehicle => vehicle.trim);

                const models =
                    await fetchEpa(`menu/model?year=${year}&make=Ford`);

                if (!models.ok) {
                    return { year, ok: false, error: models.error };
                }

                const available =
                    asList(models.body && models.body.menuItem)
                        .map(item => item.text);

                const found = [];
                const missing = [];

                for (const trim of wanted) {

                    const rule = EPA_TRIMS[trim];

                    if (!rule) {
                        missing.push({
                            trim,
                            reason: trim === "Shelby GT350R"
                                ? "the EPA does not list the GT350R separately."
                                : "the EPA has no matching model."
                        });

                        continue;
                    }

                    const matches = [];

                    for (const epaModel of rule.models.filter(name => available.includes(name))) {

                        const options =
                            await fetchEpa(
                                `menu/options?year=${year}&make=Ford&model=${encodeURIComponent(epaModel)}`
                            );

                        if (!options.ok) {
                            continue;
                        }

                        for (const option of asList(options.body && options.body.menuItem)) {

                            const liters =
                                (/([\d.]+) L\b/.exec(option.text) || [])[1];

                            if (!rule.liters || liters === rule.liters) {
                                matches.push({
                                    trim,
                                    epaModel,
                                    description: option.text,
                                    id: option.value
                                });
                            }
                        }
                    }

                    if (matches.length === 0) {
                        missing.push({
                            trim,
                            reason: "no EPA rating was found for this trim and year."
                        });
                    }

                    found.push(...matches);
                }

                return { year, ok: true, found, missing };
            })
        );


    /* Step 2: fetch ratings, at most MAX_RESULTS_PER_TOOL in total. */
    const total =
        perYear.reduce((sum, year) => sum + (year.ok ? year.found.length : 0), 0);

    let budget = MAX_RESULTS_PER_TOOL;

    const result = [];

    for (const year of perYear) {

        if (!year.ok) {
            result.push(year);

            continue;
        }

        const chosen =
            year.found.slice(0, Math.max(0, budget));

        budget -= chosen.length;

        const configurations =
            (await Promise.all(
                chosen.map(async item => {

                    const details =
                        await fetchEpa(`${encodeURIComponent(item.id)}`);

                    if (!details.ok || !details.body) {
                        return null;
                    }

                    const vehicle = details.body;
                    const number = value => Number(value) || null;

                    return {
                        trim: item.trim,
                        epaModel: item.epaModel,
                        description: item.description,
                        transmission: vehicle.trany || null,
                        city: number(vehicle.city08),
                        highway: number(vehicle.highway08),
                        combined: number(vehicle.comb08),
                        fuel: vehicle.fuelType1 || null,
                        epaUrl: `https://www.fueleconomy.gov/feg/noframes/${encodeURIComponent(item.id)}.shtml`
                    };
                })
            )).filter(Boolean);

        result.push({
            year: year.year,
            ok: true,
            configurations,
            missing: year.missing
        });
    }

    return {
        ...base,
        ok: true,
        data: {
            years: result,
            totalConfigurations: total,
            shownConfigurations: Math.min(total, MAX_RESULTS_PER_TOOL)
        }
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
                torque: vehicle ? vehicle.torque ?? null : null,
                specSource: vehicle ? vehicle.source ?? null : null,
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
    getVinRecalls,
    getFuelEconomy,
    compareVehicles
};
