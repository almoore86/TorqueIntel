/*
    TorqueIntel - Which Mustang fits me?

    Twelve questions in the result window, then up to three matching
    trims with the model years that fit best. Every spec comes from
    data/vehicles.json and every feature from data/packages.json (Ford's
    brochures and order guides), so nothing is guessed.

    Opens from the "Which Mustang fits me?" button or when someone types
    that question. Uses showResult, escapeHtml, loadPackages,
    garageButtonHtml and showApprovalGate from app.js, and loadVehicles
    from tools.js. Comparing still goes through the approval gate.
*/

const FINDER_QUESTIONS = [
    { key: "purpose", text: "What's the car mainly for?", answers: [
        ["sports", "Weekend sports car", "Fun drives, back roads"],
        ["track", "Track days", "Road courses and autocross"],
        ["dailypower", "Daily driver with power", "Every day, but quick"],
        ["commute", "Fuel-friendly commuter", "Mostly getting around"],
        ["cruise", "Top-down cruising", "Relaxed, top down when you can"],
        ["project", "Project car", "A base to modify"]] },
    { key: "riders", text: "Who rides with you?", answers: [
        ["solo", "Mostly just me"], ["one", "One passenger"], ["kids", "Kids or adults in the back", "The rear seat is small"]] },
    { key: "body", text: "Body style?", answers: [
        ["coupe", "Fastback (coupe)"], ["conv", "Convertible"], ["any", "Either"]] },
    { key: "trans", text: "Transmission?", answers: [
        ["manual", "Manual"], ["auto", "Automatic"], ["any", "Either"]] },
    { key: "age", text: "Which model years are you looking at?", answers: [
        ["new", "Newest (2021–2023)"], ["mid", "2018–2020"], ["old", "2015–2017", "Usually the least expensive"], ["any", "No preference"]] },
    { key: "priority", text: "Between two years of the same trim, which would you pick?", answers: [
        ["power", "The one with more horsepower"], ["features", "The newer one, with newer features"], ["price", "The older one, usually less expensive"]] },
    { key: "strip", text: "Any track or drag strip plans?", answers: [
        ["never", "No"], ["trackdays", "Occasional track days"], ["drag", "Drag strip"]] },
    { key: "modify", text: "Will you modify it?", answers: [
        ["stock", "Keep it stock"], ["bolt", "Light bolt-ons", "Intake, exhaust, tune"], ["build", "Major build", "Forced induction, built engine"]] },
    { key: "tech", text: "Which tech matters most?", help: "Picking one only shows model years where Ford's brochure or order guide lists it.", answers: [
        ["carplay", "Apple CarPlay and Android Auto"], ["cluster", "Digital instrument cluster"], ["assist", "Driver-assist features", "Pre-Collision Assist, blind spot, lane-keeping, adaptive cruise"], ["none", "Not important"]] },
    { key: "comfort", text: "Comfort or handling?", answers: [
        ["comfort", "Comfort", "Heated and cooled seats, softer ride"], ["balance", "A balance"], ["firm", "Sharp handling", "Firm ride is fine"]] },
    { key: "driver", text: "Do any of these apply?", answers: [
        ["first", "First car, or a younger driver"], ["insure", "Insurance cost is a concern"], ["neither", "Neither"]] },
    { key: "weather", text: "Will you drive it in cold or snow?", answers: [
        ["yes", "Yes, year-round"], ["no", "Mostly warm or fair weather"]] }
];

/* "Which Mustang fits me?" in any capitalization, with or without punctuation. */
const FINDER_REQUEST =
    /^\s*(which|what)\s+mustang\s+(fits|suits|is\s+right\s+for)\s+me\s*[?.!]*\s*$/i;

const FINDER_TRIMS = ["V6", "EcoBoost", "GT", "Bullitt", "Mach 1", "Shelby GT350", "Shelby GT350R", "Shelby GT500"];

/* Only these S550 trims were sold as convertibles. */
const FINDER_CONVERTIBLES = ["V6", "EcoBoost", "GT"];

const FINDER_YEAR_SPANS = { new: [2021, 2023], mid: [2018, 2020], old: [2015, 2017] };

const FINDER_PURPOSE_SCORE = {
    sports:     { GT: 5, Bullitt: 5, "Mach 1": 4, "Shelby GT350": 3, EcoBoost: 2 },
    track:      { "Mach 1": 5, "Shelby GT350": 5, "Shelby GT350R": 5, "Shelby GT500": 4, GT: 3, EcoBoost: 1 },
    dailypower: { GT: 5, Bullitt: 3, "Mach 1": 3, EcoBoost: 2, "Shelby GT500": 2 },
    commute:    { EcoBoost: 5, V6: 4, GT: 1 },
    cruise:     { GT: 4, EcoBoost: 4, V6: 3, Bullitt: 1 },
    project:    { GT: 5, EcoBoost: 4, V6: 2 }
};

/* Words in Ford's package lists that show a feature is there. */
const FINDER_FEATURES = {
    carplay:  ["Apple CarPlay and Android Auto", /carplay|android auto/i],
    cluster:  ["Digital instrument cluster", /12(\.4)?["”]? ?(-inch)?\s*(lcd|digital|configurable)|digital (instrument|cluster)|lcd (instrument|cluster)|all-digital/i],
    assist:   ["Driver-assist features", /pre-collision|lane[- ]keeping|blind spot|\bblis\b|adaptive cruise/i],
    heatcool: ["Heated and cooled seats", /heated and cooled|heated\/cooled|climate[- ]controlled seat/i],
    magne:    ["MagneRide adaptive suspension", /magneride/i],
    valve:    ["Active valve exhaust", /active valve|quiet start/i],
    rearseat: ["Rear seat removed", /rear[- ]seat delete|no rear seat|seat delete/i],
    summer:   ["Summer-only tires", /summer/i]
};

let finderAnswers = {};
let finderStep = 0;
let finderCars = null;
let finderPicks = [];


/* One record per model year and trim: specs, sources and features. */
async function loadFinderCars() {

    if (finderCars) {
        return finderCars;
    }

    const [vehicles, packages] =
        await Promise.all([loadVehicles(), loadPackages()]);

    finderCars = vehicles
        .filter(vehicle => FINDER_TRIMS.includes(vehicle.trim))
        .map(vehicle => {

            const year = packages[vehicle.year] || {};
            const cards = (year.trims || {})[vehicle.trim] || [];
            const features = {};

            for (const card of cards) {

                const text = [card.name, card.note || "", ...card.items].join(" ");
                const label = card.kind === "Options" ? "optional" : card.name.replace(/\s*\(Equipment Group \w+\)|: makes it a GT350R/g, "");

                for (const [key, [, pattern]] of Object.entries(FINDER_FEATURES)) {
                    if (pattern.test(text)) {
                        (features[key] ||= []).push(label);
                    }
                }
            }

            return {
                year: vehicle.year,
                trim: vehicle.trim,
                hp: vehicle.horsepower,
                torque: vehicle.torque,
                engine: vehicle.engine,
                transmissions: vehicle.transmissions,
                source: vehicle.source,
                packageSource: (year.trimSources || {})[vehicle.trim] || year.source || null,
                features
            };
        })
        .sort((a, b) => a.year - b.year);

    return finderCars;
}


function finderRange(numbers) {

    const unique = [...new Set(numbers)].sort((a, b) => a - b);

    return unique.length && unique[0] !== unique[unique.length - 1]
        ? `${unique[0]}–${unique[unique.length - 1]}`
        : String(unique[0] ?? "");
}


/* 2015, 2016, 2017, 2019 → "2015–2017, 2019" */
function finderYearList(years) {

    const unique = [...new Set(years)].sort((a, b) => a - b);
    const parts = [];

    for (let i = 0; i < unique.length; i++) {

        let j = i;

        while (j + 1 < unique.length && unique[j + 1] === unique[j] + 1) {
            j++;
        }

        parts.push(i === j ? String(unique[i]) : `${unique[i]}–${unique[j]}`);
        i = j;
    }

    return parts.join(", ");
}


/* Model years of a trim that pass the hard filters, or why none did. */
function finderCandidates(trim) {

    const a = finderAnswers;
    let cars = finderCars.filter(car => car.trim === trim);

    if (a.body === "conv" && !FINDER_CONVERTIBLES.includes(trim)) {
        return { cars: [], why: "fastback only, no convertible" };
    }

    if (a.trans === "manual") {
        cars = cars.filter(car => car.transmissions.some(t => /manual/i.test(t)));
    }

    if (a.trans === "auto") {
        cars = cars.filter(car => car.transmissions.some(t => /automatic/i.test(t)));
    }

    if (!cars.length) {
        return { cars, why: a.trans === "manual" ? "no manual offered" : "manual only" };
    }

    if (["carplay", "cluster", "assist"].includes(a.tech)) {

        const withIt = cars.filter(car => car.features[a.tech]);

        if (!withIt.length) {
            const label = FINDER_FEATURES[a.tech][0].replace(/^(Driver|Digital)/, word => word.toLowerCase());
            return { cars: [], why: `Ford's brochures don't list ${label} for it` };
        }

        cars = withIt;
    }

    return { cars, why: null };
}


function finderScore(trim) {

    const a = finderAnswers;
    const add = table => table[trim] || 0;
    let score = add(FINDER_PURPOSE_SCORE[a.purpose] || {});

    if (a.riders === "kids") score += add({ "Shelby GT350R": -6, "Shelby GT500": -1, "Shelby GT350": -1 });
    if (a.strip === "trackdays") score += add({ "Mach 1": 2, "Shelby GT350": 2, "Shelby GT350R": 2, GT: 1 });
    if (a.strip === "drag") score += add({ "Shelby GT500": 3, GT: 2, Bullitt: 1 });
    if (a.modify === "build") score += add({ GT: 2, EcoBoost: 1 });
    if (a.modify === "bolt") score += add({ GT: 1, EcoBoost: 1 });
    if (a.modify === "stock") score += add({ Bullitt: 1, "Mach 1": 1, "Shelby GT350": 1, "Shelby GT500": 1 });
    if (a.comfort === "comfort") score += add({ "Shelby GT350R": -4, "Shelby GT350": -1, "Mach 1": -1, GT: 1, EcoBoost: 1 });
    if (a.comfort === "firm") score += add({ "Mach 1": 2, "Shelby GT350": 2, "Shelby GT350R": 2, "Shelby GT500": 1 });
    if (a.driver === "first" || a.driver === "insure") score += add({ "Shelby GT350": -5, "Shelby GT350R": -5, "Shelby GT500": -6, "Mach 1": -2, Bullitt: -1, GT: -1, EcoBoost: 2, V6: 2 });
    if (a.body === "conv") score += add({ GT: 1, EcoBoost: 1 });

    const span = FINDER_YEAR_SPANS[a.age];

    if (span && !finderCars.some(car => car.trim === trim && car.year >= span[0] && car.year <= span[1])) {
        score -= 3;
    }

    return score;
}


/* Splits a trim's years wherever horsepower or transmissions change. */
function finderEras(cars) {

    const eras = [];

    for (const car of cars) {

        const key = `${car.hp}|${car.transmissions.join(",")}`;
        const last = eras[eras.length - 1];

        if (last && last.key === key && last.cars[last.cars.length - 1].year === car.year - 1) {
            last.cars.push(car);
        }

        else {
            eras.push({ key, cars: [car] });
        }
    }

    return eras;
}


/* The run of years that best fits the answers, and why. */
function finderBestYears(trim, cars) {

    const a = finderAnswers;
    const eras = finderEras(cars);
    const maxHp = Math.max(...cars.map(car => car.hp));
    const maxYear = Math.max(...cars.map(car => car.year));
    const minYear = Math.min(...cars.map(car => car.year));
    const span = FINDER_YEAR_SPANS[a.age];
    const hasTenSpeed = car => car.transmissions.some(t => /10-speed/.test(t));

    const scored = eras.map(era => {

        let score = 0;
        let pick = era.cars;
        const why = [];

        if (span) {

            const inside = era.cars.filter(car => car.year >= span[0] && car.year <= span[1]);

            if (inside.length) {
                score += 3;
                pick = inside;
                why.push(`in your ${span[0]}–${span[1]} range`);
            }
        }

        if (eras.length > 1) {

            const hp = era.cars[0].hp;

            if (a.priority === "power" && hp === maxHp && cars.some(car => car.hp < maxHp)) {
                score += 2;
                why.push(`the most horsepower of any ${trim} year (${hp} hp)`);
            }

            if (a.priority === "features" && era.cars.some(car => car.year === maxYear)) {
                score += 2;
                why.push("the newest years");
            }

            if (a.priority === "price" && era.cars.some(car => car.year === minYear)) {
                score += 2;
                why.push("the oldest years, which usually cost less");
            }

            if (a.trans === "auto" && era.cars.some(hasTenSpeed) && !cars.every(hasTenSpeed)) {
                score += 1;
                why.push("has the 10-speed automatic, which replaced the 6-speed in 2018");
            }
        }

        return { cars: pick, all: era.cars, score, why };
    });

    scored.sort((x, y) => y.score - x.score || y.all[0].year - x.all[0].year);

    if (span && !cars.some(car => car.year >= span[0] && car.year <= span[1])) {
        scored[0].why.unshift(`the ${trim} was only built ${finderYearList(cars.map(car => car.year))}, outside your ${span[0]}–${span[1]} range`);
    }

    return { best: scored[0], eras };
}


function finderRecommend() {

    const leftOut = [];
    const ranked = [];

    for (const trim of FINDER_TRIMS) {

        const { cars, why } = finderCandidates(trim);

        if (!cars.length) {
            leftOut.push([trim, why]);
            continue;
        }

        ranked.push({ trim, cars, score: finderScore(trim) });
    }

    ranked.sort((x, y) => y.score - x.score || FINDER_TRIMS.indexOf(x.trim) - FINDER_TRIMS.indexOf(y.trim));

    const picks = ranked.filter(item => item.score > 0).slice(0, 3);

    for (const pick of picks) {
        Object.assign(pick, finderBestYears(pick.trim, pick.cars));
    }

    return { picks, leftOut };
}


/* Feature → "Package (years)" lines for the given model years. */
function finderEvidence(cars, key) {

    const byPackage = {};

    for (const car of cars) {
        for (const name of car.features[key] || []) {
            (byPackage[name] ||= []).push(car.year);
        }
    }

    return Object.entries(byPackage).map(([name, years]) =>
        name === "optional"
            ? `available as an option (${finderYearList(years)})`
            : `${name} (${finderYearList(years)})`);
}


function finderReasons(trim, cars) {

    const a = finderAnswers;
    const lines = [];
    const hp = finderRange(cars.map(car => car.hp));
    const engines = [...new Set(cars.map(car => car.engine))].join(" / ");

    const purpose = {
        sports: `${engines} with ${hp} hp for weekend drives`,
        track: `${engines} with ${hp} hp`,
        dailypower: `${engines} with ${hp} hp, usable every day`,
        commute: /V8/.test(engines)
            ? `${engines} with ${hp} hp; the V8 uses more fuel than the smaller engines`
            : `${engines} with ${hp} hp, smaller than the V8s (ask about fuel economy for EPA ratings)`,
        cruise: FINDER_CONVERTIBLES.includes(trim) ? `Offered as a convertible, ${engines} with ${hp} hp` : `${engines} with ${hp} hp`,
        project: `${engines} with ${hp} hp, a common base for aftermarket parts`
    }[a.purpose];

    if (purpose) lines.push({ text: purpose });
    if (trim === "Shelby GT500") lines.push({ text: "7-speed dual-clutch automatic only" });
    if (["Bullitt", "Shelby GT350", "Shelby GT350R"].includes(trim)) lines.push({ text: "6-speed manual only" });

    const show = new Set();

    if (["carplay", "cluster", "assist"].includes(a.tech)) show.add(a.tech);
    if (a.comfort === "comfort") show.add("heatcool");
    if (a.comfort === "firm" || a.purpose === "track" || a.strip === "trackdays") show.add("magne");
    if (a.purpose === "sports" || a.strip === "drag") show.add("valve");

    for (const key of show) {

        const evidence = finderEvidence(cars, key);

        if (evidence.length) {
            lines.push({ text: `${FINDER_FEATURES[key][0]}: ${evidence.join("; ")}` });
        }
    }

    if (a.riders === "kids") {

        const evidence = finderEvidence(cars, "rearseat");

        if (evidence.length) lines.push({ warn: true, text: `Rear seat removed on: ${evidence.join("; ")}. Make sure the car you look at has one.` });
        if (trim === "Shelby GT350R") lines.push({ warn: true, text: "The GT350R is built without a rear seat." });
    }

    if (a.weather === "yes") {

        const evidence = finderEvidence(cars, "summer");

        if (evidence.length) lines.push({ warn: true, text: `Summer-only tires come with: ${evidence.join("; ")}.` });
    }

    return lines;
}


function finderNotes() {

    const a = finderAnswers;
    const notes = [];

    if (a.driver === "first" || a.driver === "insure") notes.push("V8 and Shelby trims usually cost more to insure, especially for younger drivers. Get quotes for the exact car before you buy. TorqueIntel doesn't have insurance prices.");
    if (a.driver === "first" && ["track", "sports"].includes(a.purpose)) notes.push("New to powerful rear-wheel-drive cars? A high-performance driving course is worth it before track days.");
    if (a.weather === "yes") notes.push("Summer-only tires lose grip in the cold. Plan for a set of winter or all-season tires.");
    if (a.modify === "build") notes.push("Major modifications can affect the warranty and insurance. Check both before you start.");
    if (a.riders === "kids") notes.push("Every 2015–2023 Mustang has a small rear seat. Check that car seats fit before you buy.");

    return notes;
}


/* ---------- Drawing ---------- */

function drawFinderQuestion() {

    const question = FINDER_QUESTIONS[finderStep];

    showResult(
        "Which Mustang fits me?",
        `
            <div class="result-section finder">
                <div class="finder-bar" aria-hidden="true"><span style="width:${(finderStep / FINDER_QUESTIONS.length) * 100}%"></span></div>
                <div class="finder-nav">
                    <p class="finder-progress">Question ${finderStep + 1} of ${FINDER_QUESTIONS.length}</p>
                    ${finderStep > 0 ? `<button type="button" class="text-button" data-action="finder-back">← Back</button>` : ""}
                </div>
                <h3 id="finderQuestion">${escapeHtml(question.text)}</h3>
                ${question.help ? `<p class="note">${escapeHtml(question.help)}</p>` : ""}
                <div class="finder-options" role="group" aria-labelledby="finderQuestion">
                    ${question.answers.map(([value, label, hint]) => `
                        <button type="button" class="finder-option" data-action="finder-answer" data-value="${escapeHtml(value)}" aria-pressed="${finderAnswers[question.key] === value}">
                            <span>${escapeHtml(label)}</span>
                            ${hint ? `<small>${escapeHtml(hint)}</small>` : ""}
                        </button>
                    `).join("")}
                </div>
            </div>
        `
    );

    document.querySelector(".finder-option")?.focus({ preventScroll: true });
}


function finderCardHtml(pick, index) {

    const cars = pick.best.cars;
    const latest = cars[cars.length - 1];
    const years = finderYearList(cars.map(car => car.year));
    const transmissions = [...new Set(cars.flatMap(car => car.transmissions))].join(", ");

    const sources = new Map();

    for (const car of cars) {
        if (car.source) sources.set(car.source.url, car.source.name);
        if (car.packageSource) sources.set(car.packageSource.url, car.packageSource.name);
    }

    const eraList = pick.eras.length > 1
        ? `
            <p class="detail-label">How the ${escapeHtml(pick.trim)} changed</p>
            <ul class="plain-list finder-list">
                ${pick.eras.map(era => {
                    const isBest = era.cars === pick.best.all;
                    const trs = [...new Set(era.cars.flatMap(car => car.transmissions))].join(" or ");
                    return `<li class="${isBest ? "best" : ""}">${escapeHtml(`${finderYearList(era.cars.map(car => car.year))}: ${era.cars[0].hp} hp, ${finderRange(era.cars.map(car => car.torque))} lb-ft, ${trs}${isBest ? " (best fit)" : ""}`)}</li>`;
                }).join("")}
            </ul>
        `
        : "";

    return `
        <div class="finder-card${index === 0 ? " top" : ""}">
            <span class="result-label">${index === 0 ? "Best match" : `Match ${index + 1}`}</span>
            <strong class="finder-name">${escapeHtml(`${years} Ford Mustang ${pick.trim}`)}</strong>
            <div class="result-grid finder-specs">
                <div class="result-item"><span class="result-label">Horsepower</span>${escapeHtml(finderRange(cars.map(car => car.hp)))} hp</div>
                <div class="result-item"><span class="result-label">Torque</span>${escapeHtml(finderRange(cars.map(car => car.torque)))} lb-ft</div>
                <div class="result-item"><span class="result-label">Transmissions</span>${escapeHtml(transmissions)}</div>
            </div>
            <p class="detail-label">Why it fits</p>
            <ul class="plain-list finder-list">
                ${finderReasons(pick.trim, cars).map(line => `<li class="${line.warn ? "warn" : ""}">${escapeHtml(line.text)}</li>`).join("")}
            </ul>
            ${pick.best.why.length ? `<p class="note">Why these years: ${escapeHtml(pick.best.why.join("; "))}.</p>` : ""}
            ${eraList}
            <div class="garage-actions">
                <button type="button" class="text-button" data-action="run-query" data-query="${escapeHtml(`Specs for the ${latest.year} Mustang ${pick.trim}`)}">Specs</button>
                <button type="button" class="text-button" data-action="run-query" data-query="${escapeHtml(`Recalls for the ${latest.year} Mustang`)}">Recalls</button>
                <button type="button" class="text-button" data-action="open-packages" data-year="${latest.year}" data-trim="${escapeHtml(pick.trim)}">Trims and packages</button>
                ${garageButtonHtml(latest.year, pick.trim)}
            </div>
            <details class="finder-sources">
                <summary>Sources (${sources.size})</summary>
                <ul class="plain-list">
                    ${[...sources].map(([url, name]) => `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a></li>`).join("")}
                </ul>
            </details>
        </div>
    `;
}


/*
    compareVehicles compares every year with every trim, so the finder
    compares one model year: the one offering the most of the picked
    trims, preferring a year inside the picks' best years, then the newest.
*/
function finderComparison() {

    const years = [...new Set(finderCars.map(car => car.year))];
    let best = null;

    for (const year of years) {

        const trims = finderPicks.filter(pick => finderCars.some(car => car.year === year && car.trim === pick.trim)).map(pick => pick.trim);
        const inBest = finderPicks.filter(pick => pick.best.cars.some(car => car.year === year)).length;
        const rank = [trims.length, inBest, year];

        /* Compare [trims, inBest, year] in order: the first difference decides. */
        const beats = previous => {
            const i = rank.findIndex((value, index) => value !== previous[index]);
            return i >= 0 && rank[i] > previous[i];
        };

        if (trims.length >= 2 && (!best || beats(best.rank))) {
            best = { year, trims, rank };
        }
    }

    return best;
}


function drawFinderResults() {

    const { picks, leftOut } = finderRecommend();

    finderPicks = picks;

    const chips = FINDER_QUESTIONS.map((question, index) => {

        const label = question.answers.find(([value]) => value === finderAnswers[question.key])?.[1];

        return label
            ? `<button type="button" class="follow-up" data-action="finder-edit" data-step="${index}" title="${escapeHtml(`Change: ${question.text}`)}">${escapeHtml(label)}</button>`
            : "";
    }).join("");

    const shown = new Set(picks.map(pick => pick.trim));
    const notListed = leftOut.filter(([trim]) => !shown.has(trim));
    const comparison = finderComparison();
    const notes = finderNotes();

    showResult(
        "Which Mustang fits me?",
        `
            <div class="result-section finder">
                <p class="note">Your answers (tap one to change it)</p>
                <div class="follow-ups finder-chips">${chips}</div>
            </div>
            <div class="result-section finder">
                ${picks.length
                    ? picks.map(finderCardHtml).join("")
                    : `<p class="note">No 2015–2023 Mustang matches all of those answers. Tap an answer above to loosen it, for example Either for transmission or Not important for tech.</p>`}
            </div>
            ${comparison ? `
                <div class="result-section finder">
                    <button type="button" class="accent-button" data-action="finder-compare">Compare the ${escapeHtml(`${comparison.year} ${listText(comparison.trims)}`)}</button>
                    <p class="note">compareVehicles compares one model year at a time; ${escapeHtml(String(comparison.year))} is the year that offers the most of your matches. It asks for your approval first.</p>
                </div>
            ` : ""}
            ${notes.length ? `
                <div class="result-section finder">
                    <div class="finder-notes">${notes.map(note => `<p>${escapeHtml(note)}</p>`).join("")}</div>
                </div>
            ` : ""}
            ${notListed.length ? `
                <div class="result-section finder">
                    <p class="note">Left out: ${notListed.map(([trim, why]) => `<strong>${escapeHtml(trim)}</strong> (${escapeHtml(why)})`).join("; ")}.</p>
                </div>
            ` : ""}
            <div class="result-section finder">
                <p class="source">Specs from Ford's spec sheets and brochures; features from Ford's brochures and order guides. Match order is TorqueIntel's suggestion based on your answers, not a rating.</p>
                <div class="button-row">
                    <button type="button" class="secondary-button" data-action="finder-restart">Start over</button>
                </div>
            </div>
        `
    );
}


function drawFinder() {

    if (finderStep < FINDER_QUESTIONS.length) {
        drawFinderQuestion();
    }

    else {
        drawFinderResults();
    }
}


async function openFinder() {

    try {
        await loadFinderCars();
    }

    catch (error) {

        console.error(error);
        showMessage("Which Mustang fits me?", ["TorqueIntel could not load its vehicle data. Try again in a moment."]);
        return;
    }

    finderAnswers = {};
    finderStep = 0;
    drawFinder();
}


/* Clicks inside the result window. Returns true when handled here. */
function handleFinderAction(button) {

    switch (button.dataset.action) {

        case "finder-answer":
            finderAnswers[FINDER_QUESTIONS[finderStep].key] = button.dataset.value;
            finderStep++;
            drawFinder();
            return true;

        case "finder-back":
            finderStep = Math.max(0, finderStep - 1);
            drawFinder();
            return true;

        case "finder-edit":
            finderStep = Number(button.dataset.step);
            drawFinder();
            return true;

        case "finder-restart":
            finderAnswers = {};
            finderStep = 0;
            drawFinder();
            return true;

        case "finder-compare": {

            const comparison = finderComparison();

            if (comparison) {

                pendingAction = {
                    tool: "compareVehicles",
                    args: {
                        make: "Ford",
                        model: "Mustang",
                        trims: comparison.trims,
                        years: [comparison.year],
                        criteria: [...COMPARISON_CRITERIA]
                    },
                    status: "pending",
                    sanitized: false,
                    unsupportedYears: []
                };

                showApprovalGate(pendingAction);
            }

            return true;
        }

        default:
            return false;
    }
}
