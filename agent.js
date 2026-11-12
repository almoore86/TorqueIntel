/*
    Torque Intel - agent logic

    This file contains NO page code (no document.getElementById,
    no HTML). The same logic is loaded by the app (index.html)
    and by the evaluation harness (evaluation/evaluation.js).

    Flow:

        analyzeRequest(question)
            1. checkRequestSafety   Security / Scope Guard
            2. coordinateRequest    Coordinating Agent

    The guard always runs first. The coordinator only ever sees
    the text the guard marked as safe.
*/


/*
    Limits
*/
const MAX_TURNS_PER_SESSION = 10;
const MAX_TOOL_CALLS_PER_TURN = 4;
const MAX_COMPARISON_VEHICLES = 5;
const MAX_RESULTS_PER_TOOL = 10;


/*
    Supported vehicle scope
*/
const SUPPORTED_VEHICLE = {
    make: "Ford",
    model: "Mustang",
    minYear: 2015,
    maxYear: 2023
};

/*
    Mustang trims Torque Intel can recognise in a question.
    Which trims exist in which year is decided by the data
    in data/vehicles.json, not here.
*/
const TRIMS = [
    { name: "V6", pattern: /\bv6\b/ },
    { name: "EcoBoost", pattern: /\beco[\s-]?boost\b/ },
    { name: "GT", pattern: /\bgt\b/ },
    { name: "Bullitt", pattern: /\bbullitt\b/ },
    { name: "Mach 1", pattern: /\bmach[\s-]?(1|one)\b/ },
    { name: "Shelby GT350", pattern: /\bgt[\s-]?350\b/ },
    { name: "Shelby GT350R", pattern: /\bgt[\s-]?350[\s-]?r\b/ },
    { name: "Shelby GT500", pattern: /\bgt[\s-]?500\b/ }
];

const COMPARISON_CRITERIA = [
    "engine",
    "transmission",
    "horsepower",
    "drivetrain",
    "recalls",
    "reliability"
];


/* =====================================================
    SECURITY / SCOPE GUARD
   ===================================================== */

/*
    Requests for protected information.
    A sentence that matches any of these is removed entirely.
*/
const PROTECTED_PATTERNS = [
    /\bapi[\s_-]?keys?\b/,
    /\b(access|auth|api|bearer|hugging ?face|hf)[\s_-]?tokens?\b/,
    /\bsecret[\s_-]?keys?\b/,
    /\b(your|the|any|app|application) secrets?\b/,
    /\bpass(word|code|phrase)s?\b/,
    /\bcredentials?\b/,
    /\blog[\s-]?in (details|info|information)\b/,
    /\benv(ironment)?[\s_-]?(variables?|vars?)\b/,
    /\.env\b/,
    /\bprocess\.env\b/,
    /\b(system|developer|initial|hidden|original|internal)[\s_-]?(prompts?|messages?|instructions?)\b/,
    /\byour (prompt|instructions|rules|guidelines)\b/,
    /\b(private|protected|internal|hidden|secret)[\s_-]?(config(uration)?|settings)\b/,
    /\bconfig(uration)? files?\b/
];

/*
    Prompt injection phrases.
    Only the matching phrase is removed; the rest of the
    sentence is kept if it is still an automotive question.
*/
const INJECTION_PATTERNS = [
    /\b(ignore|disregard|forget|override|bypass|skip)\b[^.!?\n]{0,40}?\b(instructions?|rules?|prompts?|guidelines?|restrictions?|guardrails?|safeguards?|filters?)\b/gi,
    /\b(ignore|disregard|forget)\b\s+(everything|all|anything)\s+(above|before|prior|previous(ly)?|you were told)\b/gi,
    /\byou are now\b[^.!?\n]*/gi,
    /\bpretend (to be|you are|you're)\b[^.!?\n]*/gi,
    /\b(developer|debug|admin|god|dan) mode\b/gi,
    /\bjailbreak\w*\b/gi,
    /\bdo anything now\b/gi,
    /\bnew instructions?\s*:/gi
];

/*
    Words that make a request automotive.
    Whole words only, so "card" does not match "car".
*/
const AUTOMOTIVE_PATTERN =
    /\b(cars?|vehicles?|automobiles?|trucks?|suvs?|sedans?|coupes?|convertibles?|fastbacks?|ford|mustangs?|engines?|motors?|v8|v6|coyote|transmissions?|gearbox(es)?|horsepower|hp|torque|drivetrains?|rwd|awd|fwd|mpg|recall(s|ed)?|reliab(le|ility)|model years?|toyota|honda|chevrolet|chevy|camaro|corvette|dodge|challenger|charger|nissan|bmw|audi|tesla|jeep|subaru|hyundai|kia|mazda|volkswagen|porsche|mercedes|lexus)\b/;

const GUARD_MESSAGES = {

    security_request:
        "Torque Intel cannot provide credentials, private configuration, system instructions, or protected application information.",

    out_of_scope:
        "Torque Intel is designed for automotive research: vehicle specifications, reliability, recalls, buying research, and vehicle comparisons."
};


/*
    Splits text into sentences, keeping the punctuation.
*/
function splitIntoSentences(text) {

    return text
        .split(/(?<=[.!?;])\s+|\n+/)
        .map(sentence => sentence.trim())
        .filter(Boolean);
}


/*
    Removes leftover joining words after a phrase was cut out,
    for example "and tell me about..." -> "tell me about...".
*/
function tidyRemainder(text) {

    return text
        .replace(/\s+/g, " ")
        .replace(/^(?:[\s,;:.!-]+|(?:and|then|also|but|instead|please|now)\b)+/i, "")
        .replace(/(?:[\s,;:.!?-]+|\b(?:and|then|also|but))+$/i, "")
        .trim();
}


/*
    Security / Scope Guard

    Returns one of:

        { allowed: true,  safeQuestion, sanitized }
        { allowed: false, intent, message }

    "intent" on a blocked request is "security_request"
    or "out_of_scope".

    "sanitized" is true when an unsafe part was removed
    but a safe automotive question remained.
*/
function checkRequestSafety(question) {

    let unsafeFound = false;

    const safeSentences = [];


    for (const sentence of splitIntoSentences(question)) {

        const lowerSentence =
            sentence.toLowerCase();


        const asksForProtectedInfo =
            PROTECTED_PATTERNS.some(
                pattern =>
                    pattern.test(lowerSentence)
            );

        if (asksForProtectedInfo) {

            unsafeFound = true;

            continue;
        }


        let remaining = sentence;

        for (const pattern of INJECTION_PATTERNS) {

            const cleaned =
                remaining.replace(pattern, " ");

            if (cleaned !== remaining) {

                unsafeFound = true;

                remaining = cleaned;
            }
        }

        remaining =
            remaining === sentence
                ? sentence
                : tidyRemainder(remaining);

        if (remaining) {
            safeSentences.push(remaining);
        }
    }


    const safeQuestion =
        safeSentences.join(" ");

    const appearsAutomotive =
        AUTOMOTIVE_PATTERN.test(
            safeQuestion.toLowerCase()
        );


    if (!appearsAutomotive) {

        const intent =
            unsafeFound
                ? "security_request"
                : "out_of_scope";

        return {
            allowed: false,
            intent,
            message: GUARD_MESSAGES[intent]
        };
    }


    return {
        allowed: true,
        safeQuestion,
        sanitized: unsafeFound
    };
}


/* =====================================================
    COORDINATING AGENT
   ===================================================== */

/*
    Vehicles that are not the Ford Mustang, including the
    Mustang Mach-E (a different vehicle) and the Dark Horse
    (introduced after the supported years).
*/
const OTHER_VEHICLE_PATTERN =
    /\b(toyota|camry|corolla|supra|honda|civic|accord|chevrolet|chevy|camaro|corvette|silverado|dodge|challenger|charger|ram|nissan|bmw|audi|tesla|jeep|subaru|hyundai|kia|mazda|miata|volkswagen|porsche|mercedes|lexus|f-?150|explorer|bronco|focus|fusion|escape|ranger|fiesta|taurus|edge|expedition|maverick|mach[\s-]?e|dark horse)\b/;

const YEAR = "((?:19|20)\\d{2})";


/*
    Finds every model year in the text, without duplicates,
    in ascending order. Understands:

        single years   "2017"
        lists          "2015, 2018 and 2020"
        ranges         "2015-2018", "2015 to 2018",
                       "2015 through 2018"
        everything     "all years", "every model year"
*/
function extractYears(text) {

    const years = new Set();

    const rangePattern =
        new RegExp(
            `\\b${YEAR}\\s*(?:-|–|—|to|through|thru|until)\\s*${YEAR}\\b`,
            "g"
        );

    for (const match of text.matchAll(rangePattern)) {

        const start = Math.min(Number(match[1]), Number(match[2]));
        const end = Math.max(Number(match[1]), Number(match[2]));

        /* Ignore absurd ranges such as "1900 to 2099". */
        if (end - start <= 30) {

            for (let year = start; year <= end; year++) {
                years.add(year);
            }
        }
    }

    for (const match of text.matchAll(new RegExp(`\\b${YEAR}\\b`, "g"))) {
        years.add(Number(match[1]));
    }

    if (
        years.size === 0 &&
        /\b(all|every|each)\s+(supported\s+|model\s+)*years?\b/.test(text)
    ) {

        for (
            let year = SUPPORTED_VEHICLE.minYear;
            year <= SUPPORTED_VEHICLE.maxYear;
            year++
        ) {
            years.add(year);
        }
    }

    return [...years].sort((a, b) => a - b);
}


function isSupportedYear(year) {

    return (
        year >= SUPPORTED_VEHICLE.minYear &&
        year <= SUPPORTED_VEHICLE.maxYear
    );
}


/*
    Finds the trims named in the text, in TRIMS order.
    An empty list means "no trim named", which the tools
    treat as "all trims".
*/
function extractTrims(text) {

    /*
        "GT350" and "GT 500" must not also count as plain "GT",
        so the Shelby names are checked first and then removed.
    */
    const shelbyPattern =
        /\bgt[\s-]?(350[\s-]?r|350|500)\b/g;

    const withoutShelbyNames =
        text.replace(shelbyPattern, " ");

    const found =
        TRIMS
            .filter(
                trim =>
                    trim.name.startsWith("Shelby")
                        ? trim.pattern.test(text)
                        : trim.pattern.test(withoutShelbyNames)
            )
            .map(trim => trim.name);

    /* "Shelby" with no number means every Shelby trim. */
    if (
        /\bshelby\b/.test(text) &&
        !found.some(name => name.startsWith("Shelby"))
    ) {
        found.push(
            ...TRIMS
                .map(trim => trim.name)
                .filter(name => name.startsWith("Shelby"))
        );
    }

    return found;
}


/*
    Decides which kind of request this is.
*/
function classifyIntent(text) {

    if (
        /\b(compare|compared|comparison|versus|vs\.?|differences? between)\b/.test(text)
    ) {
        return "vehicle_comparison";
    }

    if (/\brecall(s|ed)?\b/.test(text)) {
        return "recall_lookup";
    }

    if (
        /\b(reliable|reliability|dependable|complaints?|problems?|issues?|faults?|break(s|ing)? down)\b/.test(text)
    ) {
        return "reliability_research";
    }

    if (
        /\b(buy|buying|bought|purchase|purchasing|considering|shopping|worth it|worth buying|good deal|should i get)\b/.test(text)
    ) {
        return "buying_research";
    }

    return "vehicle_information";
}


/*
    Coordinating Agent

    Takes the SAFE question from the guard and returns a plan:

        {
            intent,            what kind of request this is
            status,            see below
            years,             supported model years to look up
            unsupportedYears,  mentioned years outside 2015-2023
            trims,             trims named ([] = all trims)
            toolCalls,         [{ tool, args }] to run, in order
            requiresApproval   true when the human gate is needed
        }

    status:
        ready                 run toolCalls now
        needs_approval        show the human gate first
        missing_year          no model year was given
        missing_trim          a comparison needs a trim
        unsupported_year      no mentioned year is in 2015-2023
        unsupported_vehicle   not a Ford Mustang
        too_many_vehicles     comparison exceeds the limit

    If some mentioned years are supported and some are not,
    the plan continues with the supported ones and lists the
    rest in unsupportedYears.

    The coordinator only PLANS. It never runs a tool.
*/
function coordinateRequest(question) {

    const text =
        question.toLowerCase();

    const intent =
        classifyIntent(text);

    const mentionedYears =
        extractYears(text);

    const years =
        mentionedYears.filter(isSupportedYear);

    const unsupportedYears =
        mentionedYears.filter(year => !isSupportedYear(year));

    const trims =
        extractTrims(text);

    const { make, model } =
        SUPPORTED_VEHICLE;

    const plan = {
        intent,
        status: "ready",
        years,
        unsupportedYears,
        trims,
        toolCalls: [],
        requiresApproval: false
    };


    if (
        !/\bmustangs?\b/.test(text) ||
        OTHER_VEHICLE_PATTERN.test(text)
    ) {
        plan.status = "unsupported_vehicle";

        return plan;
    }

    if (mentionedYears.length === 0) {
        plan.status = "missing_year";

        return plan;
    }

    if (years.length === 0) {
        plan.status = "unsupported_year";

        return plan;
    }


    if (intent === "vehicle_comparison") {

        if (trims.length === 0) {
            plan.status = "missing_trim";

            return plan;
        }

        const vehicleCount =
            years.length * trims.length;

        /* A comparison needs at least two vehicles. */
        if (vehicleCount < 2) {
            plan.status = "missing_year";

            return plan;
        }

        if (vehicleCount > MAX_COMPARISON_VEHICLES) {
            plan.status = "too_many_vehicles";

            return plan;
        }

        plan.status = "needs_approval";
        plan.requiresApproval = true;

        plan.toolCalls = [
            {
                tool: "compareVehicles",
                args: {
                    make,
                    model,
                    trims,
                    years,
                    criteria: [...COMPARISON_CRITERIA]
                }
            }
        ];

        return plan;
    }


    /*
        Each tool call covers every requested year, so a
        multi-year question still uses one call per tool.
    */
    const infoCall = {
        tool: "getVehicleInfo",
        args: { make, model, trims, years }
    };

    const recallCall = {
        tool: "getRecalls",
        args: { make, model, modelYears: years }
    };

    const reliabilityCall = {
        tool: "searchReliability",
        args: { make, model, modelYears: years }
    };


    const toolCallsByIntent = {
        vehicle_information: [infoCall],
        recall_lookup: [recallCall],
        reliability_research: [reliabilityCall, recallCall],
        buying_research: [infoCall, recallCall, reliabilityCall]
    };

    plan.toolCalls =
        toolCallsByIntent[intent]
            .slice(0, MAX_TOOL_CALLS_PER_TURN);

    return plan;
}


/* =====================================================
    PIPELINE
   ===================================================== */

/*
    Runs the guard, then the coordinator.
    This is the single entry point used by the app
    and by the evaluation harness.
*/
function analyzeRequest(question) {

    const guardResult =
        checkRequestSafety(question);


    if (!guardResult.allowed) {

        return {
            allowed: false,
            intent: guardResult.intent,
            status: "blocked",
            message: guardResult.message,
            sanitized: false,
            years: [],
            unsupportedYears: [],
            trims: [],
            toolCalls: [],
            requiresApproval: false
        };
    }


    const plan =
        coordinateRequest(guardResult.safeQuestion);

    return {
        allowed: true,
        sanitized: guardResult.sanitized,
        safeQuestion: guardResult.safeQuestion,
        ...plan
    };
}
