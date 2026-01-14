import { ARRAY_FORMATS, safeDecodeURIComponent } from "./core";
import type { ParseOptions, ValueType } from "./types";

/**
 * Decode helper that respects options.decode.
 * Also handles "+" => " " via safeDecodeURIComponent.
 */
function decodeText(text: string, decode: boolean): string {
	return decode ? safeDecodeURIComponent(text) : text;
}

function isArrayType(t: ValueType): t is "string[]" | "number[]" {
	return t === "string[]" || t === "number[]";
}

function castScalarByType(
	raw: string,
	type: Exclude<ValueType, "string[]" | "number[]">,
): string | number | boolean {
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
function castValue(
	raw: string,
	key: string,
	types: ParseOptions["types"],
	inferTypes: boolean,
): any {
	const t = types?.[key];

	if (t) {
		// For arrays, we cast elements elsewhere; this only casts a scalar token.
		const base: Exclude<ValueType, "string[]" | "number[]"> = isArrayType(t)
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

function ensureArrayIfTyped(
	value: any,
	key: string,
	types: ParseOptions["types"],
): any {
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
 * parse() with explicit branches per array.
 * - repeat: uses URLSearchParams for robust splitting of pairs
 * - bracket: manual parse so we can recognize foo[]
 * - comma: manual parse + split raw tokens on comma BEFORE decoding
 */
export function parse(
	query: string,
	options: ParseOptions = {},
): Record<string, any> {
	const {
		decode = true,
		inferTypes = false,
		array = { format: "repeat" },
		types,
	} = options;

	/**
	 * Initializes an empty object without prototype chain properties.
	 *
	 * @remarks
	 * Using `Object.create(null)` instead of `{}` or `new Object()` creates an object with no prototype.
	 * This prevents accidental property name collisions with inherited properties from `Object.prototype`
	 * (like `toString`, `hasOwnProperty`, `constructor`, etc.).
	 *
	 * This is especially important in query string parsing where user-provided keys could conflict
	 * with prototype methods, leading to unexpected behavior.
	 *
	 */
	const result: Record<string, any> = Object.create(null);

	if (typeof query !== "string") return result;

	const cleaned = query.trim().replace(/^[?#&]/, "");
	if (!cleaned) return result;

	// Validate array
	if (!ARRAY_FORMATS.includes(array.format)) {
		throw new TypeError(
			`Invalid array: ${array.format}. Must be one of: ${ARRAY_FORMATS.join(", ")}`,
		);
	}

	// -----------------------
	// Branch: repeat (default)
	// -----------------------
	if (array.format === "repeat") {
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

			const val = decodeText(rawVal, decode);
			pushValue(result, key, val);
		}

		// Post-process cast + enforce typed arrays
		for (const key of Object.keys(result)) {
			const current = result[key];

			if (Array.isArray(current)) {
				result[key] = current.map((item) =>
					item === null
						? null
						: castValue(String(item), key, types, inferTypes),
				);
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
	if (array.format === "comma") {
		const splitEncoded = array.encoded === "split";

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

			let rawSegments: string[];
			if (splitEncoded) {
				// Split on "," OR "%2C" / "%2c"
				rawSegments = rawVal
					.split(/,|%2[cC]/)
					.map((s) => s.trim())
					.filter((s) => s.length > 0);
			} else {
				// Split on "," only (preserve encoded commas)
				rawSegments = splitCommaRaw(rawVal);
			}

			if (rawSegments.length <= 1) {
				// single token: keep scalar for untyped keys; typed arrays enforced later
				// If we split via comma and got 1 item, we still need to decode it.
				// But wait, if logic dictates "comma", maybe even single item should be array?
				// Previous logic: if length <= 1, keep scalar.
				// But if we have "foo=a" and format is comma, it is interpreted as scalar "a".
				// If we have "foo=a,b", it is ["a", "b"].
				// This seems consistent with general qs behavior.
				const val = decodeText(rawVal, decode);
				pushValue(result, key, val);
			} else {
				// multiple tokens: decode each segment
				const decodedSegments = rawSegments.map((seg) =>
					decodeText(seg, decode),
				);
				// For comma format, when we truly have multiple segments, store as array
				pushValue(result, key, decodedSegments);
			}
		}

		// Flatten nested arrays caused by repeated keys (foo=a,b&foo=c)
		for (const key of Object.keys(result)) {
			const current = result[key];

			if (Array.isArray(current)) {
				const flat: unknown[] = [];
				for (const item of current) {
					if (Array.isArray(item)) flat.push(...item);
					else flat.push(item);
				}
				result[key] = flat;
			}

			// Cast
			const afterFlatten = result[key];
			if (Array.isArray(afterFlatten)) {
				result[key] = afterFlatten.map((item) =>
					item === null
						? null
						: castValue(String(item), key, types, inferTypes),
				);
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
