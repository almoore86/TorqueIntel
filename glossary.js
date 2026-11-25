/*
    TorqueIntel - glossary

    Plain-English explanations of the terms the app uses, with
    labeled diagrams for the ones that are easier to see.

    Two ways in:
      - the Glossary button (top right) opens the full, searchable list
      - with "Explain terms" switched on in a result window, glossary
        words get a dotted underline; clicking one explains it

    This file has no knowledge of the agent or tools. app.js calls
    linkGlossaryTerms() after it fills the result window.
*/

const GLOSSARY = [
    ["horsepower", "Horsepower", "Power", "How much work the engine can do over time. More horsepower means stronger acceleration at higher speeds and a higher top speed. Think of it as how fast you can keep pedaling a bike."],
    ["torque", "Torque", "Power", "The twisting force the engine makes. More torque means a stronger shove from a stop and when passing. Think of it as how hard you can push the bike pedal. Horsepower = torque × rpm ÷ 5,252."],
    ["lb-ft", "lb-ft (pound-feet)", "Power", "The unit for torque: one pound of force on a lever one foot long. 420 lb-ft is like hanging 420 pounds on the end of a one-foot wrench."],
    ["rpm", "rpm and redline", "Power", "Revolutions per minute: how fast the engine is spinning. The redline is the highest safe engine speed, marked in red on the tachometer. The Shelby GT350 revs to 8,250 rpm."],
    ["sae", "SAE J1349", "Power", "The industry standard Ford uses to measure horsepower and torque, so ratings are comparable between cars. Ford notes its ratings use premium fuel."],
    ["ecoboost", "EcoBoost", "Engine", "Ford's name for its turbocharged, direct-injection engines. The Mustang's is a 2.3-liter four-cylinder."],
    ["turbo", "Turbocharger vs. supercharger", "Engine", "Both force extra air into the engine for more power. A turbocharger is spun by exhaust gas (EcoBoost). A supercharger is driven by the engine itself (Shelby GT500)."],
    ["ti-vct", "Ti-VCT", "Engine", "Twin independent variable camshaft timing: the engine adjusts when its valves open, for both power and efficiency."],
    ["flat-plane", "Flat-plane vs. cross-plane crank", "Engine", "How a V8's crankshaft is shaped. Flat-plane (Shelby GT350) revs higher and has a sharp, howling sound. Cross-plane (GT, GT500) is smoother with the classic V8 rumble."],
    ["displacement", "Displacement (5.0L, 2.3L)", "Engine", "The total volume of the engine's cylinders. Bigger usually means more power and more fuel used."],
    ["rear-wheel-drive", "Rear-wheel drive", "Drivetrain", "The engine powers only the rear wheels, like every 2015–2023 Mustang. Great for handling; needs more care in snow."],
    ["limited-slip", "Limited-slip differential", "Drivetrain", "Keeps both rear wheels pushing instead of letting one spin when it loses grip."],
    ["torsen", "TORSEN differential", "Drivetrain", "A gear-type limited-slip differential that sends more power to the rear wheel with more grip, so you lose less traction accelerating out of corners."],
    ["axle-ratio", "Axle ratio (3.55, 3.73)", "Drivetrain", "How many times the driveshaft turns for each turn of the rear wheels. A higher number like 3.73 gives quicker acceleration but higher engine speed on the highway."],
    ["rev-matching", "Rev Matching", "Drivetrain", "On manual Mustangs, the car briefly raises engine speed when you downshift so the shift is smooth, like a skilled driver's heel-toe."],
    ["dual-clutch", "Dual-clutch transmission", "Drivetrain", "An automatic with two clutches that pre-select the next gear for very fast shifts. The 2020–2022 Shelby GT500 uses a 7-speed TREMEC unit."],
    ["brembo", "Brembo brakes", "Brakes and chassis", "A high-performance brake brand. More pistons per caliper (like 6-piston) clamp harder and handle heat better on hard driving."],
    ["caliper", "Caliper and pistons", "Brakes and chassis", "The caliper squeezes the brake pads against the rotor. Its pistons do the squeezing; more pistons spread the force evenly."],
    ["two-piece-rotor", "Two-piece rotors", "Brakes and chassis", "Brake discs made of an iron braking surface bolted to a lighter aluminum center. They save weight and cope with track heat."],
    ["magneride", "MagneRide", "Brakes and chassis", "Shock absorbers filled with fluid that stiffens in a magnetic field. They adjust about 1,000 times a second for a smoother ride and sharper handling."],
    ["k-member", "K-member brace", "Brakes and chassis", "A brace under the front subframe that makes the front end stiffer, so steering feels more precise."],
    ["strut-tower", "Strut-tower brace", "Brakes and chassis", "A bar across the engine bay joining the tops of the front suspension, reducing flex in hard corners."],
    ["sway-bar", "Sway bar", "Brakes and chassis", "A bar linking the left and right suspension that reduces body lean in corners."],
    ["line-lock", "Line-lock", "Brakes and chassis", "Holds the front brakes while the rear wheels spin, to warm the tires at the drag strip. Track use only."],
    ["launch-control", "Launch control", "Brakes and chassis", "Holds engine speed at an ideal level for the quickest possible start from a stop."],
    ["summer-tires", "Summer-only tires", "Wheels and tires", "Sticky performance tires that grip best in warm weather. Ford doesn't recommend them below about 45°F or in snow."],
    ["tire-size", "Tire size (255/40R19)", "Wheels and tires", "255 is the tire's width in millimeters. 40 means the sidewall height is 40% of that width. R means radial. 19 is the wheel diameter in inches."],
    ["staggered", "Staggered wheels", "Wheels and tires", "Wider wheels and tires at the rear than the front, for more grip where the power goes."],
    ["equipment-group", "Equipment group (101A, 401A)", "Packages", "Ford's code for a bundle of features at a trim level. For example, Equipment Group 401A is the Premium Plus bundle on a GT Premium."],
    ["performance-package", "Performance Package", "Packages", "Ford's factory bundle of brake, suspension, cooling, wheel and differential upgrades for harder driving."],
    ["r-package", "R Package (GT350R)", "Packages", "The Equipment Group 920A bundle that turns a Shelby GT350 into a GT350R: carbon-fiber wheels, a rear wing and weight-saving deletions."],
    ["vin", "VIN", "Research", "Vehicle Identification Number: the car's unique 17-character ID. It never uses the letters I, O or Q."],
    ["check-digit", "Check digit", "Research", "The 9th character of a VIN, worked out from the other 16. It lets TorqueIntel catch most typos instantly."],
    ["recall", "Recall", "Research", "A manufacturer's fix for a safety problem, done free at a dealer. NHTSA tracks recalls by model year."],
    ["complaint", "Owner complaint", "Research", "A problem report an owner filed with NHTSA. NHTSA publishes them without verifying each one, so they are a signal, not a verdict."],
    ["mpg", "EPA mpg (city, highway, combined)", "Research", "The government's fuel economy ratings. Combined blends city and highway driving. Your own mileage will vary."],
    ["monroney", "Window sticker (Monroney label)", "Research", "The sticker a new car is required to carry by law, listing price, equipment, fuel economy and where it was built."]
];

const DIAGRAMS = {
    "tire-size": `<svg viewBox="0 0 340 230" role="img" aria-label="Tire size 255/40R19: 255 is width in millimeters, 40 is sidewall height as a percent of width, R is radial, 19 is wheel diameter in inches">
        <text class="big" x="170" y="28" text-anchor="middle"><tspan fill="#38BDF8">255</tspan>/<tspan fill="#f2c97d">40</tspan><tspan fill="#6fcf97">R</tspan><tspan fill="#f28b82">19</tspan></text>
        <rect class="tire" x="120" y="58" width="100" height="40" rx="10"/><text x="170" y="82" text-anchor="middle">tire</text>
        <rect class="tire" x="120" y="172" width="100" height="40" rx="10"/><text x="170" y="196" text-anchor="middle">tire</text>
        <rect class="dim" x="128" y="98" width="84" height="74"/>
        <path class="acc" stroke="#38BDF8" d="M120 50H220"/><text x="170" y="46" text-anchor="middle" fill="#38BDF8">255 mm wide</text>
        <path class="acc" stroke="#f2c97d" d="M232 58V98"/><text x="238" y="74">40% of width</text><text x="238" y="88">= sidewall height</text>
        <path class="acc" stroke="#f28b82" d="M104 98V172"/><text x="98" y="132" text-anchor="end">19 in.</text><text x="98" y="146" text-anchor="end">wheel</text>
        <text x="170" y="138" text-anchor="middle">wheel (cut away)</text>
        <text x="170" y="226" text-anchor="middle" fill="#6fcf97">R = radial construction</text>
    </svg>`,
    "caliper": `<svg viewBox="0 0 340 220" role="img" aria-label="Wheel with the brake rotor behind the spokes and the caliper clamped over the rotor's edge">
        <circle class="tire" cx="120" cy="110" r="95"/>
        <circle class="ln" cx="120" cy="110" r="72"/>
        <circle class="dim" cx="120" cy="110" r="56"/>
        <circle class="ln" cx="120" cy="110" r="16"/>
        <path class="ln" d="M120 94V38M134 118l48 28M106 118l-48 28M135 104l52-20M105 104l-52-20"/>
        <rect x="150" y="40" width="48" height="34" rx="9" transform="rotate(35 174 57)" fill="#38BDF8" fill-opacity="0.25" stroke="#38BDF8" stroke-width="3"/>
        <circle class="accfill" cx="166" cy="50" r="4"/><circle class="accfill" cx="177" cy="57" r="4"/><circle class="accfill" cx="188" cy="64" r="4"/>
        <path class="thin" d="M198 52L250 36"/><text class="lab" x="254" y="34">Caliper</text><text x="254" y="48">squeezes the pads</text>
        <path class="thin" d="M190 70L250 84"/><text x="254" y="82">Pistons (6 on a</text><text x="254" y="95">Brembo 6-piston)</text>
        <path class="thin" d="M160 140L250 140"/><text class="lab" x="254" y="138">Rotor (disc)</text><text x="254" y="151">behind the spokes</text>
        <path class="thin" d="M190 175L250 182"/><text x="254" y="186">Wheel and tire</text>
    </svg>`,
    "two-piece-rotor": `<svg viewBox="0 0 340 200" role="img" aria-label="Two-piece rotor: iron braking ring bolted to a lighter aluminum center hat">
        <circle cx="110" cy="100" r="85" fill="#2b3446" stroke="#CBD5E1" stroke-width="2"/>
        <circle cx="110" cy="100" r="50" fill="#38BDF8" fill-opacity="0.25" stroke="#38BDF8" stroke-width="3"/>
        <circle class="ln" cx="110" cy="100" r="18"/>
        ${[0,45,90,135,180,225,270,315].map(a => `<circle class="accfill" cx="${(110 + 42 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(100 + 42 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="3"/>`).join("")}
        <path class="thin" d="M185 60L230 45"/><text class="lab" x="234" y="44">Iron ring</text><text x="234" y="57">where the pads grip</text>
        <path class="thin" d="M150 105L230 110"/><text class="lab" x="234" y="108">Aluminum hat</text><text x="234" y="121">lighter center</text>
        <path class="thin" d="M148 86L230 82"/><text x="234" y="82">bolts join them</text>
    </svg>`,
    "k-member": `<svg viewBox="0 0 340 210" role="img" aria-label="Underside view of the front end: the K-member subframe holds the engine and suspension, and the K-member brace ties it to the body">
        <text x="170" y="16" text-anchor="middle">Underneath the front of the car (front at top)</text>
        <rect class="tire" x="20" y="40" width="34" height="70" rx="8"/><rect class="tire" x="286" y="40" width="34" height="70" rx="8"/>
        <rect class="dim" x="130" y="30" width="80" height="60" rx="6"/><text x="170" y="64" text-anchor="middle">engine</text>
        <path class="ln" d="M70 70L130 95H210L270 70M130 95L110 140M210 95L230 140M110 140H230"/>
        <text x="250" y="112">K-member</text><text x="250" y="125">(front subframe)</text>
        <path class="acc" d="M110 140L170 185L230 140M170 185V150"/>
        <path class="thin" d="M178 180L235 190"/><text class="lab" x="238" y="194">K-member brace</text>
        <text x="20" y="200">Schematic, not to scale</text>
    </svg>`,
    "strut-tower": `<svg viewBox="0 0 340 200" role="img" aria-label="Top view of the engine bay: a bar connects the tops of the two front strut towers">
        <text x="170" y="16" text-anchor="middle">Looking down into the engine bay (front at bottom)</text>
        <path class="ln" d="M40 30H300V190H40Z"/>
        <circle class="dim" cx="80" cy="60" r="20"/><circle class="dim" cx="260" cy="60" r="20"/>
        <text x="80" y="96" text-anchor="middle">strut tower</text><text x="260" y="96" text-anchor="middle">strut tower</text>
        <rect class="dim" x="125" y="80" width="90" height="80" rx="8"/><text x="170" y="124" text-anchor="middle">engine</text>
        <path class="acc" d="M80 60H260"/><circle class="accfill" cx="80" cy="60" r="5"/><circle class="accfill" cx="260" cy="60" r="5"/>
        <text class="lab" x="170" y="52" text-anchor="middle" fill="#38BDF8">strut-tower brace</text>
        <text x="170" y="182" text-anchor="middle">grille / front bumper</text>
    </svg>`,
    "sway-bar": `<svg viewBox="0 0 340 190" role="img" aria-label="Front view: the sway bar links the left and right suspension to reduce body lean">
        <text x="170" y="16" text-anchor="middle">Front view</text>
        <path class="ln" d="M70 40H270L285 95H55Z"/><text x="170" y="72" text-anchor="middle">body</text>
        <rect class="tire" x="22" y="95" width="36" height="78" rx="8"/><rect class="tire" x="282" y="95" width="36" height="78" rx="8"/>
        <path class="ln" d="M58 140L120 132M282 140L220 132"/><text x="72" y="160">lower arm</text>
        <path class="acc" d="M100 120V150H240V120"/><path class="thin" d="M100 120L100 134M240 120L240 134"/>
        <text class="lab" x="170" y="168" text-anchor="middle" fill="#38BDF8">sway bar</text>
        <text x="170" y="182" text-anchor="middle">twists to resist one side dipping in a corner</text>
    </svg>`,
    "staggered": `<svg viewBox="0 0 340 200" role="img" aria-label="Top view: rear tires are wider than the front tires">
        <text x="170" y="16" text-anchor="middle">Top view (front at top)</text>
        <path class="ln" d="M110 30H230L245 185H95Z"/>
        <rect class="tire" x="70" y="40" width="30" height="55" rx="6"/><rect class="tire" x="240" y="40" width="30" height="55" rx="6"/>
        <rect class="tire" x="56" y="120" width="44" height="58" rx="6"/><rect class="tire" x="240" y="120" width="44" height="58" rx="6"/>
        <text x="290" y="70">narrower front</text><text x="290" y="83">e.g. 255 mm</text>
        <text x="296" y="148" fill="#38BDF8">wider rear</text><text x="296" y="161">e.g. 275 mm</text>
    </svg>`
};

const GLOSSARY_BY_ID =
    Object.fromEntries(GLOSSARY.map(entry => [entry[0], entry]));

const GLOSSARY_CATEGORIES =
    ["All", ...new Set(GLOSSARY.map(entry => entry[2]))];


/*
    Words in result text that link to a glossary entry.
    Whole words only; checked in this order, so longer phrases win.
*/
const GLOSSARY_PATTERNS = [
    ["k-member", /\bK-member brace\b/i],
    ["strut-tower", /\bstrut[- ]tower brace\b/i],
    ["two-piece-rotor", /\btwo-piece rotors?\b|\b2-piece rotors?\b/i],
    ["summer-tires", /\bsummer-only tires\b/i],
    ["limited-slip", /\blimited-slip(?: rear)? differential\b|\blimited-slip\b/i],
    ["rear-wheel-drive", /\brear-wheel drive\b/i],
    ["rev-matching", /\bRev Matching\b/i],
    ["dual-clutch", /\bdual-clutch\b/i],
    ["launch-control", /\blaunch control\b/i],
    ["line-lock", /\bline-lock\b/i],
    ["flat-plane", /\bflat-plane\b|\bcross-plane\b/i],
    ["equipment-group", /\bEquipment Group \d{3}A\b/],
    ["performance-package", /\bPerformance Package\b/],
    ["r-package", /\bR Package\b/],
    ["tire-size", /\b\d{3}\/\d{2}Z?R\d{2}\b/],
    ["torsen", /\bTORSEN\b/],
    ["brembo", /\bBrembo\b/],
    ["caliper", /\bcalipers?\b/i],
    ["magneride", /\bMagneRide\b/],
    ["sway-bar", /\bsway bar\b/i],
    ["ti-vct", /\bTi-VCT\b/],
    ["ecoboost", /\bEcoBoost\b/],
    ["turbo", /\bsupercharged\b|\bsupercharger\b|\bturbocharged\b/i],
    ["horsepower", /\bhorsepower\b/i],
    ["torque", /\btorque\b/i],
    ["lb-ft", /\blb-ft\b/i],
    ["mpg", /\bmpg\b/],
    ["recall", /\brecalls?\b/i],
    ["complaint", /\bowner complaints?\b/i],
    ["vin", /\bVIN\b/]
];

const GLOSSARY_REGEX =
    new RegExp(GLOSSARY_PATTERNS.map(([, pattern]) => `(${pattern.source})`).join("|"), "gi");

/* Same pattern without the global flag, for yes/no checks (no lastIndex state). */
const GLOSSARY_TEST =
    new RegExp(GLOSSARY_REGEX.source, "i");

const EXPLAIN_KEY = "torqueintel.explainTerms";


function explainTermsOn() {

    try {
        return localStorage.getItem(EXPLAIN_KEY) === "on";
    }

    catch (error) {
        return false;
    }
}


function setExplainTerms(on) {

    try {
        localStorage.setItem(EXPLAIN_KEY, on ? "on" : "off");
    }

    catch (error) {
        /* Storage blocked: the switch still works for this visit. */
    }
}


/* Which glossary entry a matched piece of text belongs to. */
function glossaryIdFor(text) {

    const match =
        GLOSSARY_PATTERNS.find(([, pattern]) => new RegExp(`^(?:${pattern.source})$`, pattern.flags.replace("g", "")).test(text));

    return match ? match[0] : null;
}


/*
    Wraps glossary words inside a container with clickable terms.
    Text inside buttons, links, form fields and existing terms is
    left alone.
*/
function linkGlossaryTerms(container) {

    const skip = "button, a, input, textarea, select, label, .glossary-term, svg, script, style";

    const walker =
        document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
            acceptNode: node =>
                node.parentElement && !node.parentElement.closest(skip) && GLOSSARY_TEST.test(node.nodeValue)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT
        });

    const nodes = [];

    while (walker.nextNode()) {
        nodes.push(walker.currentNode);
    }

    for (const node of nodes) {

        const text = node.nodeValue;
        const fragment = document.createDocumentFragment();

        let last = 0;

        GLOSSARY_REGEX.lastIndex = 0;

        for (const match of text.matchAll(GLOSSARY_REGEX)) {

            const id = glossaryIdFor(match[0]);

            if (!id) {
                continue;
            }

            fragment.append(text.slice(last, match.index));

            const term = document.createElement("button");
            term.type = "button";
            term.className = "glossary-term";
            term.dataset.term = id;
            term.title = "What does this mean?";
            term.textContent = match[0];

            fragment.append(term);

            last = match.index + match[0].length;
        }

        fragment.append(text.slice(last));
        node.replaceWith(fragment);
    }
}


function glossaryDiagramHtml(id) {

    return DIAGRAMS[id]
        ? `<figure class="diagram">${DIAGRAMS[id]}<figcaption>Diagram, not to scale.</figcaption></figure>`
        : "";
}


/* ---------- Popups (native dialogs, above the result window) ---------- */

let glossaryCategory = "All";
let lastExplainedTerm = null;


function openGlossaryDialog(dialog) {

    if (typeof dialog.showModal === "function") {
        if (!dialog.open) dialog.showModal();
    }

    else {
        dialog.setAttribute("open", "");
    }
}


function closeGlossaryDialog(dialog) {

    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
}


function anyGlossaryDialogOpen() {

    return [...document.querySelectorAll("dialog.glossary-dialog")].some(dialog => dialog.open);
}


function explainTerm(id) {

    const entry = GLOSSARY_BY_ID[id];

    if (!entry) {
        return;
    }

    lastExplainedTerm = id;

    document.getElementById("termCategory").textContent = entry[2].toUpperCase();
    document.getElementById("termTitle").textContent = entry[1];
    document.getElementById("termText").textContent = entry[3];
    document.getElementById("termDiagram").innerHTML = glossaryDiagramHtml(id);

    openGlossaryDialog(document.getElementById("termDialog"));
}


function renderGlossaryCategories() {

    const box = document.getElementById("glossaryCategories");

    box.replaceChildren(
        ...GLOSSARY_CATEGORIES.map(category => {

            const chip = document.createElement("button");

            chip.type = "button";
            chip.className = "topic-button";
            chip.textContent = category;
            chip.setAttribute("aria-pressed", String(category === glossaryCategory));

            chip.addEventListener("click", () => {
                glossaryCategory = category;
                renderGlossaryCategories();
                renderGlossaryList();
            });

            return chip;
        })
    );
}


function renderGlossaryList(highlightId) {

    const query =
        document.getElementById("glossarySearch").value.trim().toLowerCase();

    const entries =
        GLOSSARY.filter(([, name, category, text]) =>
            (glossaryCategory === "All" || category === glossaryCategory) &&
            (!query || name.toLowerCase().includes(query) || text.toLowerCase().includes(query)));

    document.getElementById("glossaryCount").textContent =
        `${entries.length} of ${GLOSSARY.length} terms`;

    document.getElementById("glossaryList").replaceChildren(
        ...entries.map(([id, name, category, text]) => {

            const item = document.createElement("div");
            item.className = "glossary-item" + (id === highlightId ? " highlight" : "");
            item.id = "glossary-" + id;

            const label = document.createElement("span");
            label.className = "result-label";
            label.textContent = category;

            const title = document.createElement("strong");
            title.textContent = name;

            const body = document.createElement("p");
            body.textContent = text;

            item.append(label, title, body);
            item.insertAdjacentHTML("beforeend", glossaryDiagramHtml(id));

            return item;
        })
    );

    if (highlightId) {
        document.getElementById("glossary-" + highlightId)?.scrollIntoView({ block: "center" });
    }
}


function showGlossary(highlightId) {

    if (highlightId) {
        glossaryCategory = "All";
        document.getElementById("glossarySearch").value = "";
    }

    renderGlossaryCategories();
    renderGlossaryList(highlightId);

    closeGlossaryDialog(document.getElementById("termDialog"));
    openGlossaryDialog(document.getElementById("glossaryDialog"));
}


function setupGlossary() {

    document.getElementById("glossaryButton").addEventListener("click", () => showGlossary());
    document.getElementById("glossarySearch").addEventListener("input", () => renderGlossaryList());
    document.getElementById("termToGlossary").addEventListener("click", () => showGlossary(lastExplainedTerm));

    for (const dialog of document.querySelectorAll("dialog.glossary-dialog")) {

        dialog.addEventListener("click", event => {
            if (event.target === dialog || event.target.closest("[data-close-dialog]")) {
                closeGlossaryDialog(dialog);
            }
        });
    }

    document.addEventListener("click", event => {

        const term = event.target.closest(".glossary-term");

        if (term) {
            explainTerm(term.dataset.term);
        }
    });
}
