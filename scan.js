/*
    TorqueIntel - VIN scanning

    Reads a VIN from:
      - a photo of the barcode (on phones, the button opens the camera)
      - a photo of the 17 printed characters (text recognition)

    Everything runs in the browser. The photo never leaves the device;
    only the VIN is used, when the person presses Look up.

    The barcode and text-recognition libraries are large, so they are
    loaded only when someone first scans. Uses isValidVin() from agent.js.
*/

const SCAN_LIBRARIES = {
    zxing: "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js",
    tesseract: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"
};

const loadedScripts = new Map();


function loadScript(url) {

    if (!loadedScripts.has(url)) {

        loadedScripts.set(url, new Promise((resolve, reject) => {

            const script = document.createElement("script");

            script.src = url;
            script.onload = resolve;
            script.onerror = () => {
                loadedScripts.delete(url);
                reject(new Error("library_unavailable"));
            };

            document.head.appendChild(script);
        }));
    }

    return loadedScripts.get(url);
}


/* ---------- Turning raw text into a VIN ---------- */

/*
    Ford door-label barcodes are usually Code 39, and some add a
    leading "I" for imported vehicles, so look for a valid 17-character
    run anywhere in the value.
*/
function vinFromBarcodeText(raw) {

    const text =
        String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

    for (let i = 0; i + 17 <= text.length; i++) {

        const candidate = text.slice(i, i + 17);

        if (isValidVin(candidate)) {
            return { vin: candidate, raw: candidate, changes: [], checked: true };
        }
    }

    const loose = text.match(/[A-HJ-NPR-Z0-9]{17}/);

    return loose
        ? { vin: loose[0], raw: loose[0], changes: [], checked: false }
        : null;
}


/* Letters VINs never use become the digits they are mistaken for. */
const NEVER_IN_VIN = { O: "0", Q: "0", I: "1" };

/* Pairs text recognition confuses; tried only to make the check digit add up. */
const LOOK_ALIKES = { "8": "B", B: "8", "5": "S", S: "5", "2": "Z", Z: "2", "6": "G", G: "6", "0": "D", D: "0", U: "V", V: "U" };


/*
    Every 17-character run in the recognized text is a candidate. The one
    needing the fewest corrections wins, so a clean reading always beats a
    "fixed" one, and a run that only passes after several swaps loses.
*/
function vinFromPrintedText(text) {

    const lines =
        String(text || "").toUpperCase()
            .replace(/\bVIN\b|\bV\.I\.N\.?/g, " ")
            .split(/\n/)
            .map(line => line.replace(/[^A-Z0-9]/g, ""));

    const streams = [...new Set([...lines, lines.join("")])];

    let best = null;
    let fallback = null;

    const consider = candidate => {
        if (!best || candidate.changes.length < best.changes.length) best = candidate;
    };

    for (const stream of streams) {

        for (let i = 0; i + 17 <= stream.length; i++) {

            const raw = stream.slice(i, i + 17);
            const fixed = [...raw].map(char => NEVER_IN_VIN[char] || char);

            const changes =
                [...raw]
                    .map((char, index) => char !== fixed[index] ? `${char}→${fixed[index]} (position ${index + 1})` : null)
                    .filter(Boolean);

            const base = fixed.join("");

            if (isValidVin(base)) {
                consider({ vin: base, raw, changes, checked: true });
                continue;
            }

            const spots =
                fixed.map((char, index) => LOOK_ALIKES[char] ? index : -1).filter(index => index >= 0).slice(0, 6);

            for (let mask = 1; mask < (1 << spots.length); mask++) {

                const attempt = fixed.slice();
                const swaps = [];

                spots.forEach((index, bit) => {
                    if (mask & (1 << bit)) {
                        swaps.push(`${attempt[index]}→${LOOK_ALIKES[attempt[index]]} (position ${index + 1})`);
                        attempt[index] = LOOK_ALIKES[attempt[index]];
                    }
                });

                if (swaps.length > 2) {
                    continue;
                }

                const vin = attempt.join("");

                if (isValidVin(vin)) {
                    consider({ vin, raw, changes: [...changes, ...swaps], checked: true });
                }
            }

            if (!fallback && /^[A-HJ-NPR-Z0-9]{17}$/.test(base)) {
                fallback = { vin: base, raw, changes, checked: false };
            }
        }
    }

    return best || fallback;
}


/* ---------- Images ---------- */

function imageFromFile(file) {

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.src = url;

    return image.decode().then(() => image);
}


function scaledCanvas(image, maxSide, rotate, highContrast) {

    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.round(image.naturalWidth * scale);
    const height = Math.round(image.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = rotate ? height : width;
    canvas.height = rotate ? width : height;

    const context = canvas.getContext("2d");

    if (rotate) {
        context.translate(height, 0);
        context.rotate(Math.PI / 2);
    }

    context.drawImage(image, 0, 0, width, height);

    if (highContrast) {

        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < pixels.data.length; i += 4) {
            const gray = 0.299 * pixels.data[i] + 0.587 * pixels.data[i + 1] + 0.114 * pixels.data[i + 2];
            const value = Math.max(0, Math.min(255, (gray - 128) * 1.6 + 128));
            pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
        }

        context.putImageData(pixels, 0, 0);
    }

    return canvas;
}


/* ---------- Barcodes ---------- */

function barcodeHints() {

    const Z = window.ZXing;
    const hints = new Map();

    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
        Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.DATA_MATRIX,
        Z.BarcodeFormat.PDF_417, Z.BarcodeFormat.QR_CODE
    ]);

    hints.set(Z.DecodeHintType.TRY_HARDER, true);

    return hints;
}


async function readBarcodesFromImage(image) {

    /* The phone's own reader first (Chrome on Android). */
    if ("BarcodeDetector" in window) {

        try {
            const detector = new BarcodeDetector({ formats: ["code_39", "code_128", "data_matrix", "pdf417", "qr_code"] });
            const found = await detector.detect(image);

            if (found.length) {
                return found.map(code => code.rawValue);
            }
        }

        catch (error) {
            /* Fall through to the library. */
        }
    }

    await loadScript(SCAN_LIBRARIES.zxing);

    const Z = window.ZXing;

    for (const size of [1600, 1000, 2400]) {

        for (const rotate of [false, true]) {

            try {
                const source = new Z.HTMLCanvasElementLuminanceSource(scaledCanvas(image, size, rotate, false));
                const reader = new Z.MultiFormatReader();

                reader.setHints(barcodeHints());

                return [reader.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(source))).getText()];
            }

            catch (error) {
                /* Try the next size or rotation. */
            }
        }
    }

    return [];
}


/* ---------- Printed characters ---------- */

let textReader = null;


async function getTextReader(onStatus) {

    if (textReader) {
        return textReader;
    }

    await loadScript(SCAN_LIBRARIES.tesseract);

    onStatus("Loading the text reader (first time only, about 7 MB)…");

    textReader = await Tesseract.createWorker("eng", 1, {
        logger: message => {
            if (message.status === "recognizing text") {
                onStatus(`Reading the printed characters… ${Math.round((message.progress || 0) * 100)}%`);
            }
        }
    });

    await textReader.setParameters({
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        tessedit_pageseg_mode: "6"
    });

    return textReader;
}


async function readPrintedVin(image, onStatus) {

    const reader = await getTextReader(onStatus);

    let unchecked = null;

    for (const rotate of [false, true]) {

        const { data } = await reader.recognize(scaledCanvas(image, 2000, rotate, true));
        const hit = vinFromPrintedText(data.text);

        if (hit && hit.checked) {
            return hit;
        }

        unchecked = unchecked || hit;
    }

    return unchecked;
}


/*
    Reads a VIN from a photo.
    mode: "barcode", "text", or "auto" (barcode first, then text).
    Resolves { hit, method, message }. hit is null when nothing was found.
*/
async function scanVinFromPhoto(file, mode, onStatus) {

    let image;

    try {
        image = await imageFromFile(file);
    }

    catch (error) {
        return { hit: null, message: "That photo couldn't be opened. Try taking it again." };
    }

    if (mode !== "text") {

        onStatus("Looking for a barcode…");

        let values = [];

        try {
            values = await readBarcodesFromImage(image);
        }

        catch (error) {
            return { hit: null, message: "The barcode reader couldn't load. Check your connection and try again, or type the VIN." };
        }

        const hit = values.map(vinFromBarcodeText).find(Boolean);

        if (hit) {
            return { hit, method: "from the barcode" };
        }

        if (mode === "barcode") {
            return {
                hit: null,
                message: values.length
                    ? "A barcode was read, but it doesn't contain a VIN. Try the barcode next to the VIN on the door-frame sticker, or use Read printed VIN."
                    : "No barcode found. Get closer so the barcode fills the photo, avoid glare, and try again, or use Read printed VIN."
            };
        }
    }

    try {

        onStatus("Reading the printed characters…");

        const hit = await readPrintedVin(image, onStatus);

        return hit
            ? { hit, method: "from the printed characters" }
            : { hit: null, message: "Couldn't find 17 VIN characters in that photo. Get closer, keep the camera straight, avoid glare and shadows, and try again. You can also type the VIN." };
    }

    catch (error) {

        console.error(error);

        return { hit: null, message: "The text reader couldn't start on this device. You can still scan the barcode or type the VIN." };
    }
}
