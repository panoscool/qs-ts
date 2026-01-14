import { safeDecodeURIComponent } from "./core.js";
import type { ArrayFormat, ParseOptions, TypeName } from "./types.js";

/**
 * Decode helper that respects options.decode.
 * Also handles "+" => " " via safeDecodeURIComponent.
 */
function decodeText(text: string, decode: boolean): string {
    return decode ? safeDecodeURIComponent(text) : text;
}

function isArrayType(t: TypeName): t is "string[]" | "number[]" {
    return t === "string[]" || t === "number[]";
}

function castScalarByType(raw: string, type: Exclude<TypeName, "string[]" | "number[]">): string | number | boolean {
    switch (type) {
        case "string":
            return raw;

        case "number": {
            const n = Number(raw);
            return raw.trim() !== "" && Number.isFinite(n) ? n : raw;
        }

        case "boolean":
            if (raw === "true") return true;
            if (raw === "false") return false;
            return raw;

        default:
            return raw;
    }
}

/**
 * If the key has an explicit type, cast accordingly.
 * If inferTypes is enabled, infer (boolean/number/null) only for untyped keys.
 */
function castValue(raw: string, key: string, types: ParseOptions["types"], inferTypes: boolean): any {
    const t = types?.[key];

    if (t) {
        // For arrays, we cast elements elsewhere; this only casts a scalar token.
        const base: Exclude<TypeName, "string[]" | "number[]"> = isArrayType(t)
            ? (t.slice(0, -2) as any)
            : (t as any);

        return castScalarByType(raw, base);
    }

    if (inferTypes) {
        if (raw === "true") return true;
        if (raw === "false") return false;
        if (raw === "null") return null;

        const n = Number(raw);
        if (raw.trim() !== "" && Number.isFinite(n)) return n;
    }

    return raw;
}

function ensureArrayIfTyped(value: any, key: string, types: ParseOptions["types"]): any {
    const t = types?.[key];
    if (!t || !isArrayType(t)) return value;
    return Array.isArray(value) ? value : [value];
}

function splitCommaRaw(raw: string): string[] {
    // split raw, trim, drop empty segments
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

/**
 * Accumulate into result:
 * - first assignment => scalar
 * - repeated => array
 */
function pushValue(result: Record<string, any>, key: string, value: any): void {
    const existing = result[key];

    if (existing === undefined) {
        result[key] = value;
        return;
    }

    if (Array.isArray(existing)) {
        existing.push(value);
        return;
    }

    result[key] = [existing, value];
}

/**
 * Normalize bracket keys: foo[] -> foo (only in bracket format)
 */
function normalizeBracketKey(key: string): string {
    return key.endsWith("[]") ? key.slice(0, -2) : key;
}

/**
 * parse() with explicit branches per arrayFormat.
 * - repeat: uses URLSearchParams for robust splitting of pairs
 * - bracket: manual parse so we can recognize foo[]
 * - comma: manual parse + split raw tokens on comma BEFORE decoding
 */
export function parse(query: string, options: ParseOptions = {}): Record<string, any> {
    const {
        decode = true,
        inferTypes = false,
        arrayFormat = "repeat",
        types,
    } = options;

    const result: Record<string, any> = Object.create(null);

    if (typeof query !== "string") return result;

    const cleaned = query.trim().replace(/^[?#&]/, "");
    if (!cleaned) return result;

    // -----------------------
    // Branch: repeat (default)
    // -----------------------
    if (arrayFormat === "repeat") {
        // URLSearchParams handles splitting pairs and repeated keys.
        // But we still apply our own decoding/casting rules to match options.
        const usp = new URLSearchParams(cleaned);

        // IMPORTANT: URLSearchParams already decodes, and also converts '+' to space in many environments.
        // We want decode=false to preserve raw; USP cannot do that.
        // So for decode=false we must not use USP.
        if (!decode) {
            // Fall back to manual parsing for decode=false.
            // (same behavior as bracket/repeat manual parsing)
            for (const part of cleaned.split("&")) {
                if (!part) continue;

                const eq = part.indexOf("=");
                const rawKey = eq === -1 ? part : part.slice(0, eq);
                const rawVal = eq === -1 ? undefined : part.slice(eq + 1);

                const key = rawKey; // no decode
                if (rawVal === undefined) {
                    pushValue(result, key, null);
                    continue;
                }

                const val = rawVal; // no decode
                pushValue(result, key, val);
            }
        } else {
            // decode=true path: let USP decode, then we cast below
            // We also need to distinguish "a" vs "a=":
            // USP treats "a" as ("a",""), which would not match our intended "null".
            // So we must detect bare keys ourselves even in decode=true.
            const bareKeys = new Set<string>();
            for (const part of cleaned.split("&")) {
                if (!part) continue;
                if (!part.includes("=")) {
                    // decode key if needed
                    bareKeys.add(decodeText(part, true));
                }
            }

            // read all keys
            for (const [k, v] of usp.entries()) {
                // if key was bare in the raw string, treat it as null, not empty string
                if (bareKeys.has(k) && v === "") {
                    pushValue(result, k, null);
                } else {
                    pushValue(result, k, v);
                }
            }
        }

        // Post-process cast + enforce typed arrays
        for (const key of Object.keys(result)) {
            const current = result[key];

            if (Array.isArray(current)) {
                result[key] = current.map((item) => (item === null ? null : castValue(String(item), key, types, inferTypes)));
            } else if (current !== null) {
                result[key] = castValue(String(current), key, types, inferTypes);
            }

            result[key] = ensureArrayIfTyped(result[key], key, types);
        }

        return result;
    }

    // -----------------------
    // Branch: bracket
    // -----------------------
    if (arrayFormat === "bracket") {
        for (const part of cleaned.split("&")) {
            if (!part) continue;

            const eq = part.indexOf("=");
            const rawKey = eq === -1 ? part : part.slice(0, eq);
            const rawVal = eq === -1 ? undefined : part.slice(eq + 1);

            const decodedKey = decodeText(rawKey, decode);
            const key = normalizeBracketKey(decodedKey);

            if (rawVal === undefined) {
                pushValue(result, key, null);
                continue;
            }

            const decodedVal = decodeText(rawVal, decode);
            pushValue(result, key, decodedVal);
        }

        // Cast + enforce typed arrays
        for (const key of Object.keys(result)) {
            const current = result[key];

            if (Array.isArray(current)) {
                result[key] = current.map((item) => (item === null ? null : castValue(String(item), key, types, inferTypes)));
            } else if (current !== null) {
                result[key] = castValue(String(current), key, types, inferTypes);
            }

            result[key] = ensureArrayIfTyped(result[key], key, types);
        }

        return result;
    }

    // -----------------------
    // Branch: comma
    // -----------------------
    // Note: split commas BEFORE decoding so "%2C" stays a literal comma and is not split.
    if (arrayFormat === "comma") {
        for (const part of cleaned.split("&")) {
            if (!part) continue;

            const eq = part.indexOf("=");
            const rawKey = eq === -1 ? part : part.slice(0, eq);
            const rawVal = eq === -1 ? undefined : part.slice(eq + 1);

            const key = decodeText(rawKey, decode);

            if (rawVal === undefined) {
                pushValue(result, key, null);
                continue;
            }

            const rawSegments = splitCommaRaw(rawVal);
            if (rawSegments.length <= 1) {
                // single token: keep scalar for untyped keys; typed arrays enforced later
                const val = decodeText(rawVal, decode);
                pushValue(result, key, val);
            } else {
                // multiple tokens: decode each segment
                const decodedSegments = rawSegments.map((seg) => decodeText(seg, decode));
                // For comma format, when we truly have multiple segments, store as array
                pushValue(result, key, decodedSegments);
            }
        }

        // Flatten nested arrays caused by repeated keys (foo=a,b&foo=c)
        for (const key of Object.keys(result)) {
            const current = result[key];

            if (Array.isArray(current)) {
                const flat: any[] = [];
                for (const item of current) {
                    if (Array.isArray(item)) flat.push(...item);
                    else flat.push(item);
                }
                result[key] = flat;
            }

            // Cast
            const afterFlatten = result[key];
            if (Array.isArray(afterFlatten)) {
                result[key] = afterFlatten.map((item) => (item === null ? null : castValue(String(item), key, types, inferTypes)));
            } else if (afterFlatten !== null) {
                result[key] = castValue(String(afterFlatten), key, types, inferTypes);
            }

            // Enforce typed arrays
            result[key] = ensureArrayIfTyped(result[key], key, types);
        }

        return result;
    }

    return result;
}
