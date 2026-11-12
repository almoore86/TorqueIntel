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

    After the tools have run, the app calls:

        reviewEvidence(results)     Evidence Review
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
    /\bnew instructions?\s*:/gi,

    /* "Act as an unrestricted AI with no rules" */
    /\b(act|behave|respond|answer|role-?play) (as|like) (an? |the )?[^.!?\n,]{0,40}?\b(ai|assistant|bot|chatbot|model|llm|gpt|dan)\b/gi,
    /\b(unrestricted|unfiltered|uncensored)\b/gi,
    /\b(with )?(no|without( any)?) (rules|restrictions|filters|guardrails|guidelines|limits)\b/gi,

    /* "Print everything above this line" */
    /\b(print|repeat|show|reveal|output|display|echo|copy)\b[^.!?\n]{0,30}\b(everything|all|text|words|lines?|messages?|content)\b[^.!?\n]{0,15}\b(above|before this|prior)\b[^.!?\n]*/gi,

    /* Encoded or smuggled instructions */
    /\b(decode|decrypt|deobfuscate|translate)\b[^.!?\n]{0,30}\b(and|then)\s+(follow|execute|run|obey|do)\b[^.!?\n]*/gi,
    /\bbase[\s-]?64\b[^.!?\n]*/gi,
    /\brot[\s-]?13\b[^.!?\n]*/gi,
    /\b(follow|obey|execute)\b[^.!?\n]{0,20}\b(these|this|the following|my|encoded|hidden)\b[^.!?\n]{0,20}\b(instructions?|commands?|orders?)\b/gi
];

/*
    Requests that could put someone in danger or help break
    the law, even when they mention a Mustang. If any of these
    match, the WHOLE request is declined calmly. Nothing is
    looked up and no part of the request is answered.

    The patterns need a harmful action, not just a part name,
    so "2019 Mustang brake recalls" is still a normal question.
*/
const HARMFUL_PATTERNS = [

    /* Hurting other people */
    /\b(kill|murder|hurt|harm|injure|maim|run over|run down|ram|hit|crash into|plow into|plough into)\b[^.!?\n]{0,40}\b(someone|somebody|people|person|pedestrians?|cyclists?|protest(e|o)rs?|crowds?|kids?|children|him|her|them|cops?|police|officers?|(my|the|a) (wife|husband|girlfriend|boyfriend|ex|boss|neighbou?r|coworker|friend|brother|sister|mom|dad|mother|father|teacher))\b/,

    /* Hurting yourself */
    /\b(kill|hurt|harm)\s+myself\b/,
    /\bsuicid\w*\b/,
    /\bend (my|it) (life|all)\b/,
    /\b(want|wanna|going|plan(ning)?) to die\b/,
    /\bcrash\b[^.!?\n]{0,30}\bon purpose\b/,

    /* Sabotaging a vehicle */
    /\b(cut|sever|tamper\w*|sabotag\w*|loosen|drain|puncture|slash)\b[^.!?\n]{0,40}\b(brake lines?|brakes?|brake fluid|lug nuts?|wheel nuts?|steering|tires?|tyres?|fuel lines?)\b/,
    /\b(disable|deactivate|defeat|remove)\b[^.!?\n]{0,30}\b(air ?bags?|seat ?belts?)\b/,
    /\b(bombs?|explosives?|weaponi[sz]e\w*)\b/,

    /* Theft */
    /\bsteal(ing)?\s+(a|an|the|my|his|her|their|this|that|some(one|body)'?s?)\b/,
    /\bhot[\s-]?wir(e|ing)\b/,
    /\bbreak(ing)? into\b/,
    /\bcar[\s-]?jack\w*\b/,
    /\b(bypass|defeat|disable)\w*\b[^.!?\n]{0,30}\b(immobili[sz]er|alarm|anti[\s-]?theft|tracker|gps)\b/,

    /* Fraud */
    /\b(roll(ing)? ?back|tamper\w* with|turn(ing)? back|wind(ing)? back)\b[^.!?\n]{0,30}\b(odometer|mileage|miles)\b/,
    /\b(fake|forge|forged|falsify|alter|clone|swap)\b[^.!?\n]{0,30}\b(vin|vins|title|license plates?|number plates?|registration)\b/,

    /* Dangerous or illegal driving */
    /\b(outrun|evade|escape|flee|lose|get away from)\b[^.!?\n]{0,30}\b(police|cops?|troopers?|officers?)\b/,
    /\bstreet rac(e|es|ing)\b/,
    /\b(drunk|buzzed) driv(e|ing)\b/,
    /\bdriv(e|ing)\b[^.!?\n]{0,20}\b(drunk|wasted|high|stoned)\b/
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

    harmful_request:
        "Torque Intel can't help with that. It only supports safe, lawful vehicle research. If someone may be in danger, or you are thinking about hurting yourself, please contact your local emergency services right away (in the US, call 911, or call or text 988 for the Suicide & Crisis Lifeline). Torque Intel is glad to help with Mustang specifications, recalls, reliability, or comparisons instead.",

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

    "intent" on a blocked request is "harmful_request",
    "security_request" or "out_of_scope".

    Harm is checked first, on the whole request. A harmful
    request is never trimmed down and partly answered.

    "sanitized" is true when an unsafe part was removed
    but a safe automotive question remained.
*/
function checkRequestSafety(question) {

    const lowerQuestion =
        question.toLowerCase();

    if (HARMFUL_PATTERNS.some(pattern => pattern.test(lowerQuestion))) {

        return {
            allowed: false,
            intent: "harmful_request",
            message: GUARD_MESSAGES.harmful_request
        };
    }


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
    EVIDENCE REVIEW
   ===================================================== */

/*
    Evidence Review

    Runs AFTER the tools and BEFORE the response is shown.
    It reads what each tool actually returned and reports:

        findings   what the evidence supports
        gaps       what was asked for but is not backed by data

    It never adds data. Its job is to make sure the response
    only claims what a named source returned, and to say so
    plainly when something is missing.

    Takes the list of tool results ({ ok, tool, source,
    data | error }) and returns:

        {
            status,    "complete" | "partial" | "none"
            items: [
                { tool, source, status, findings, gaps }
            ]
        }

    status:
        complete   every requested item came back from a source
        partial    some items came back, some did not
        none       nothing usable came back
*/
const EVIDENCE_ERROR_TEXT = {
    invalid_arguments: "the tool was called with missing or wrong arguments",
    not_found: "no matching entry in the dataset",
    data_unavailable: "the vehicle dataset could not be loaded",
    network_error: "the source could not be reached",
    service_error: "the source returned an unexpected response",
    not_implemented: "this tool has no data source yet"
};


function plural(count, word) {

    return `${count} ${word}${count === 1 ? "" : "s"}`;
}


function reviewToolResult(result) {

    const findings = [];
    const gaps = [];

    const data =
        result.data || {};

    const errorText = code =>
        EVIDENCE_ERROR_TEXT[code] || "the tool failed";


    if (!result.source || !result.source.name) {
        gaps.push("No source was recorded for this result.");
    }


    if (result.tool === "getVehicleInfo") {

        const vehicles = data.vehicles || [];
        const missing = data.missing || [];

        if (vehicles.length) {
            findings.push(
                `${vehicles.length} dataset ${vehicles.length === 1 ? "entry" : "entries"} found.`
            );
        }

        for (const item of missing) {
            gaps.push(
                `No dataset entry for ${[item.year, "Mustang", item.trim].filter(Boolean).join(" ")}.`
            );
        }

        if (!result.ok && result.error !== "not_found") {
            gaps.push(`Specifications not available: ${errorText(result.error)}.`);
        }
    }


    else if (
        result.tool === "getRecalls" ||
        result.tool === "searchReliability"
    ) {

        const word =
            result.tool === "getRecalls" ? "recall" : "complaint";

        if (!result.ok) {
            gaps.push(`Nothing was checked: ${errorText(result.error)}.`);
        }

        for (const year of data.years || []) {

            if (year.ok) {
                findings.push(
                    `${year.modelYear}: ${plural(year.totalCount, word)} on file.`
                );
            }

            else {
                gaps.push(
                    `${year.modelYear}: could not be checked (${errorText(year.error)}). This does not mean there is nothing on file.`
                );
            }
        }
    }


    else if (result.tool === "compareVehicles") {

        if (!result.ok) {
            gaps.push(`The comparison was not completed: ${errorText(result.error)}.`);
        }

        const rows = data.rows || [];
        const criteria = data.criteria || [];

        const found =
            rows.filter(row => row.found);

        if (found.length) {
            findings.push(
                `Specifications found for ${found.length} of ${plural(rows.length, "vehicle")}.`
            );
        }

        for (const row of rows.filter(row => !row.found)) {
            gaps.push(`No dataset entry for ${row.year} Mustang ${row.trim}.`);
        }

        const countChecks = [
            ["recalls", "recallCount", "Recall"],
            ["reliability", "complaintCount", "Complaint"]
        ];

        for (const [criterion, field, label] of countChecks) {

            if (!criteria.includes(criterion)) {
                continue;
            }

            const years =
                [...new Set(rows.map(row => row.year))];

            const failed =
                years.filter(
                    year =>
                        rows.find(row => row.year === year)[field] === null ||
                        rows.find(row => row.year === year)[field] === undefined
                );

            if (failed.length < years.length) {
                findings.push(
                    `${label} counts retrieved for ${years.length - failed.length} of ${plural(years.length, "model year")}.`
                );
            }

            if (failed.length) {
                gaps.push(
                    `${label} counts could not be checked for ${failed.join(", ")}.`
                );
            }
        }
    }


    else {
        gaps.push("This tool is not recognised, so its output was not reviewed.");
    }


    const status =
        findings.length === 0
            ? "none"
            : gaps.length === 0
                ? "complete"
                : "partial";

    return {
        tool: result.tool,
        source: result.source ? result.source.name : null,
        status,
        findings,
        gaps
    };
}


function reviewEvidence(results) {

    const items =
        (results || []).map(reviewToolResult);

    let status = "partial";

    if (items.length === 0 || items.every(item => item.status === "none")) {
        status = "none";
    }

    else if (items.every(item => item.status === "complete")) {
        status = "complete";
    }

    return {
        status,
        items
    };
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
