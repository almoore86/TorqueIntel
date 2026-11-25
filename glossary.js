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
    "k-member": `<svg viewBox="0 0 400 330" role="img" aria-label="Underside view of the front of an S550 Mustang. The K-member is the front subframe under the engine; it carries the lower control arms and steering rack and bolts to the body's frame rails. The K-member brace ties the rear K-member mounts to the frame rails behind them.">
        <text x="200" y="16" text-anchor="middle">Looking up at the underside (front bumper at top)</text>
        <path class="thin" d="M40 30H360"/><text x="200" y="44" text-anchor="middle">front bumper</text>
        <rect x="112" y="54" width="14" height="250" rx="3" fill="none" stroke="var(--text-muted)" stroke-width="1.4" stroke-dasharray="5 4"/>
        <rect x="274" y="54" width="14" height="250" rx="3" fill="none" stroke="var(--text-muted)" stroke-width="1.4" stroke-dasharray="5 4"/>
        <text x="106" y="300" text-anchor="end">frame rail</text><text x="294" y="300">frame rail</text>
        <rect class="tire" x="16" y="70" width="42" height="92" rx="10"/><rect class="tire" x="342" y="70" width="42" height="92" rx="10"/>
        <rect class="dim" x="58" y="104" width="14" height="24" rx="3"/><rect class="dim" x="328" y="104" width="14" height="24" rx="3"/>
        <text x="37" y="178" text-anchor="middle">wheel</text><text x="363" y="178" text-anchor="middle">wheel</text>
        <rect x="150" y="54" width="100" height="48" rx="10" fill="none" stroke="var(--text-muted)" stroke-width="1.4" stroke-dasharray="4 3"/>
        <text x="200" y="74" text-anchor="middle">engine oil pan</text><text x="200" y="88" text-anchor="middle">(above, inside)</text>
        <path class="ln" d="M72 112L104 128H296L328 112"/>
        <rect class="dim" x="170" y="121" width="60" height="14" rx="4"/>
        <text x="200" y="116" text-anchor="middle">steering rack</text>
        <path d="M86 148 L314 148 L314 170 L270 172 L252 216 L234 216 L246 174 L154 174 L166 216 L148 216 L130 172 L86 170 Z" fill="var(--border)" stroke="var(--text-soft)" stroke-width="2"/>
        <text x="200" y="165" text-anchor="middle" class="lab">K-member (subframe)</text>
        <path class="ln" d="M72 120L98 154M72 126L140 172"/><path class="ln" d="M328 120L302 154M328 126L260 172"/>
        <text x="16" y="196">lower control arms</text><path class="thin" d="M70 190L110 160"/>
        <circle cx="119" cy="159" r="4.5" fill="var(--text-soft)"/><circle cx="281" cy="159" r="4.5" fill="var(--text-soft)"/>
        <circle cx="157" cy="208" r="4.5" fill="var(--text-soft)"/><circle cx="243" cy="208" r="4.5" fill="var(--text-soft)"/>
        <text x="16" y="222">K-member bolts</text><text x="16" y="235">to the body here</text><path class="thin" d="M86 216L150 208"/>
        <rect x="178" y="226" width="44" height="78" rx="10" fill="none" stroke="var(--text-muted)" stroke-width="1.4" stroke-dasharray="4 3"/>
        <text x="200" y="320" text-anchor="middle">transmission</text>
        <path class="acc" d="M157 208L243 208M157 208L119 262M243 208L281 262"/>
        <circle class="accfill" cx="119" cy="262" r="5"/><circle class="accfill" cx="281" cy="262" r="5"/>
        <text class="lab" x="300" y="228" fill="#38BDF8">K-member brace</text>
        <text x="300" y="242">ties the rear</text><text x="300" y="255">K-member mounts</text><text x="300" y="268">to the frame rails</text>
        <path class="thin" d="M298 230L262 232"/>
    </svg>`,
    "strut-tower": `<svg viewBox="0 0 380 280" role="img" aria-label="Top view into an S550 Mustang engine bay. The two front strut towers sit at the rear corners of the bay, near the windshield. Each has a strut top mount held by three studs. The strut-tower brace is a bar bolted across the tops of both towers, over the back of the engine.">
        <text x="190" y="14" text-anchor="middle">Looking down into the engine bay (windshield at top)</text>
        <rect x="24" y="22" width="332" height="20" rx="4" fill="var(--border)" stroke="var(--text-muted)" stroke-width="1.4"/>
        <text x="190" y="36" text-anchor="middle">windshield and cowl</text>
        <path class="ln" d="M24 42V230Q24 262 60 262H320Q356 262 356 230V42"/>
        <circle class="dim" cx="80" cy="82" r="30"/><circle class="dim" cx="300" cy="82" r="30"/>
        <circle cx="80" cy="82" r="12" fill="var(--bg)" stroke="var(--text-soft)" stroke-width="1.6"/>
        <circle cx="300" cy="82" r="12" fill="var(--bg)" stroke="var(--text-soft)" stroke-width="1.6"/>
        <rect x="122" y="96" width="136" height="120" rx="12" fill="var(--border)" stroke="var(--text-soft)" stroke-width="2"/>
        <rect x="150" y="112" width="80" height="88" rx="8" fill="none" stroke="var(--text-muted)" stroke-width="1.4"/>
        <path class="thin" d="M160 126H220M160 142H220M160 158H220M160 174H220M160 190H220"/>
        <text x="190" y="232" text-anchor="middle" class="lab">engine (V8 intake on top)</text>
        <rect x="70" y="244" width="240" height="10" rx="3" fill="var(--border)" stroke="var(--text-muted)" stroke-width="1.2"/>
        <text x="190" y="275" text-anchor="middle">radiator, then grille and front bumper</text>
        <path d="M64 70 L96 70 L102 82 L96 94 L64 94 L58 82 Z" fill="#38BDF8" fill-opacity="0.22" stroke="#38BDF8" stroke-width="2.5"/>
        <path d="M284 70 L316 70 L322 82 L316 94 L284 94 L278 82 Z" fill="#38BDF8" fill-opacity="0.22" stroke="#38BDF8" stroke-width="2.5"/>
        <path d="M98 78H282M98 86H282" stroke="#38BDF8" stroke-width="3" fill="none"/>
        ${[[80, 82], [300, 82]].map(([x, y]) => [0, 120, 240].map(a => `<circle cx="${(x + 15 * Math.cos((a - 90) * Math.PI / 180)).toFixed(1)}" cy="${(y + 15 * Math.sin((a - 90) * Math.PI / 180)).toFixed(1)}" r="3.2" fill="#0B0F19" stroke="#38BDF8" stroke-width="1.5"/>`).join("")).join("")}
        <text class="lab" x="190" y="66" text-anchor="middle" fill="#38BDF8">strut-tower brace</text>
        <path class="thin" d="M80 116V134"/><text x="80" y="146" text-anchor="middle">strut tower</text><text x="80" y="159" text-anchor="middle">(top of front</text><text x="80" y="172" text-anchor="middle">suspension)</text>
        <path class="thin" d="M300 116V134"/><text x="308" y="146" text-anchor="middle">strut top mount</text><text x="308" y="159" text-anchor="middle">(3 studs hold</text><text x="308" y="172" text-anchor="middle">the brace end)</text>
    </svg>`,
    "sway-bar": `<svg viewBox="0 0 380 300" role="img" aria-label="Front view of the front suspension. Each wheel's knuckle is held by a lower control arm to the K-member and by a strut with a coil spring up to the strut tower. The sway bar runs across the car in bushings on the subframe, and an end link at each end connects it to the suspension. In a corner the bar twists and pushes back, reducing body lean.">
        <text x="190" y="14" text-anchor="middle">Looking at the front suspension from the front</text>
        <path class="thin" d="M8 252H372"/><text x="190" y="266" text-anchor="middle">road</text>
        <text x="190" y="284" text-anchor="middle">In a corner the outside wheel pushes up; the bar twists</text><text x="190" y="297" text-anchor="middle">and pushes back on the other side, so the car leans less.</text>
        <path d="M62 40 Q190 14 318 40 L330 92 H50 Z" fill="none" stroke="var(--text-muted)" stroke-width="1.4" stroke-dasharray="5 4"/>
        <text x="190" y="62" text-anchor="middle">body (strut towers at the top corners)</text>
        <rect class="tire" x="14" y="128" width="44" height="122" rx="10"/><rect class="tire" x="322" y="128" width="44" height="122" rx="10"/>
        <rect class="dim" x="58" y="168" width="16" height="44" rx="3"/><rect class="dim" x="306" y="168" width="16" height="44" rx="3"/>
        <text x="66" y="230" text-anchor="middle">knuckle</text>
        <path class="ln" d="M68 168L90 86M312 168L290 86" stroke-width="7" stroke="var(--border-strong)"/>
        <path class="ln" d="M68 168L90 86M312 168L290 86" stroke-width="2"/>
        <path class="thin" d="M74 140l14-4 -10 -8 14-4 -10-8 14-4 -10-8 14-4 -10-8 14-4"/>
        <path class="thin" d="M306 140l-14-4 10 -8 -14-4 10-8 -14-4 10-8 -14-4 10-8 -14-4"/>
        <circle cx="90" cy="86" r="5" fill="var(--text-soft)"/><circle cx="290" cy="86" r="5" fill="var(--text-soft)"/>
        <text x="104" y="112">strut (damper</text><text x="104" y="125">+ coil spring)</text>
        <rect class="dim" x="124" y="212" width="132" height="18" rx="5"/><text x="190" y="225" text-anchor="middle">K-member</text>
        <path class="ln" d="M72 206L128 220M308 206L252 220"/><text x="80" y="244">lower control arm</text>
        <path class="acc" d="M98 184H282"/>
        <path class="acc" d="M98 184L84 178M282 184L296 178"/>
        <rect x="142" y="178" width="14" height="13" rx="3" fill="var(--bg)" stroke="#38BDF8" stroke-width="1.6"/><rect x="224" y="178" width="14" height="13" rx="3" fill="var(--bg)" stroke="#38BDF8" stroke-width="1.6"/>
        <path d="M84 178L80 140M296 178L300 140" stroke="#f2c97d" stroke-width="3" fill="none"/>
        <circle cx="80" cy="140" r="3.5" fill="#f2c97d"/><circle cx="84" cy="178" r="3.5" fill="#f2c97d"/><circle cx="300" cy="140" r="3.5" fill="#f2c97d"/><circle cx="296" cy="178" r="3.5" fill="#f2c97d"/>
        <text x="314" y="112" fill="#f2c97d">end link</text><path class="thin" d="M320 116L302 150"/>
        <text class="lab" x="190" y="176" text-anchor="middle" fill="#38BDF8">sway bar</text>
        <text x="190" y="204" text-anchor="middle">bushing mounts</text>
        <path class="thin" d="M166 200L154 192M214 200L226 192"/>
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
