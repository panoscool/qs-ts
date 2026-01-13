import { splitOnFirst, safeDecodeURIComponent } from "./core.js";
import type { ParseOptions, TypeName } from "./types.js";

function maybeDecode(text: string, options: ParseOptions): string {
    return options.decode === false ? text : safeDecodeURIComponent(text);
}

function parseScalarValue(value: string, options: ParseOptions, key: string): any {
    // 0) explicit types
    const typeDef = options.types?.[key];
    if (typeDef) {
        const isArrayType = typeDef.endsWith("[]");
        const baseType = (isArrayType ? typeDef.slice(0, -2) : typeDef) as Exclude<TypeName, "string[]" | "number[]">;

        if (baseType === "number") {
            const n = Number(value);
            return value.trim() !== "" && Number.isFinite(n) ? n : value;
        }

        if (baseType === "boolean") {
            if (value === "true") return true;
            if (value === "false") return false;
            return value;
        }

        return value; // string
    }

    // 1) inferTypes (optional)
    if (options.inferTypes) {
        if (value === "true") return true;
        if (value === "false") return false;
        if (value === "null") return null;

        const n = Number(value);
        if (value.trim() !== "" && Number.isFinite(n)) return n;
    }

    return value;
}

function splitCommaRaw(raw: string): string[] {
    // split raw, trim, drop empty segments
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

export function parse(query: string, options: ParseOptions = {}): Record<string, any> {
    const opts: Required<Pick<ParseOptions, "decode" | "arrayFormat">> & ParseOptions = {
        decode: true,
        arrayFormat: "repeat",
        ...options,
    };

    const result: Record<string, any> = Object.create(null);

    if (typeof query !== "string") return result;

    const cleaned = query.trim().replace(/^[?#&]/, "");
    if (!cleaned) return result;

    for (const param of cleaned.split("&")) {
        if (!param) continue;

        let [rawKey, rawValue] = splitOnFirst(param, "=");

        // decode key once
        const key = maybeDecode(rawKey, opts);

        // value missing => null (matches your current behavior)
        if (rawValue === undefined) {
            // bracket normalization still applies to key
            const finalKey = opts.arrayFormat === "bracket" && key.endsWith("[]") ? key.slice(0, -2) : key;

            if (result[finalKey] === undefined) result[finalKey] = null;
            else if (Array.isArray(result[finalKey])) result[finalKey].push(null);
            else result[finalKey] = [result[finalKey], null];

            continue;
        }

        // bracket normalization
        const normalizedKey =
            opts.arrayFormat === "bracket" && key.endsWith("[]") ? key.slice(0, -2) : key;

        // IMPORTANT: for comma format, split BEFORE decoding
        const rawParts =
            opts.arrayFormat === "comma" ? splitCommaRaw(rawValue) : [rawValue];

        // decode each part
        const decodedParts = rawParts.map((p) => maybeDecode(p, opts));

        // accumulate
        const incoming: any = opts.arrayFormat === "comma" ? decodedParts : decodedParts[0];

        if (result[normalizedKey] === undefined) {
            result[normalizedKey] = incoming;
        } else if (Array.isArray(result[normalizedKey])) {
            result[normalizedKey].push(incoming);
        } else {
            result[normalizedKey] = [result[normalizedKey], incoming];
        }
    }

    // Post-process:
    // - flatten comma arrays when repeated keys produced nested arrays
    // - apply type casting / inferTypes
    // - wrap scalar to array if types says `...[]`
    for (const key of Object.keys(result)) {
        let val = result[key];

        // Flatten nested arrays produced by comma parsing + repeated keys
        // Example: foo=a,b&foo=c -> accumulator makes: [ ["a","b"], ["c"] ] or [ ["a","b"], "c" ]
        if (opts.arrayFormat === "comma") {
            if (Array.isArray(val)) {
                const flat: any[] = [];
                for (const item of val) {
                    if (Array.isArray(item)) flat.push(...item);
                    else flat.push(item);
                }
                val = flat;
                result[key] = val;
            }
        }

        val = result[key];

        // Apply casting/inference
        if (Array.isArray(val)) {
            result[key] = val.map((item) => (item === null ? null : parseScalarValue(String(item), opts, key)));
        } else {
            if (val !== null) {
                result[key] = parseScalarValue(String(val), opts, key);
            }
        }

        // Enforce explicit array types
        const typeDef = opts.types?.[key];
        if (typeDef && typeDef.endsWith("[]") && !Array.isArray(result[key])) {
            result[key] = [result[key]];
        }
    }

    return result;
}
