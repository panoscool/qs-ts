import {
	decodeText,
	splitCommaRaw,
	splitOnFirst,
	validateArrayFormat,
	validateOnTypeError,
} from "./core";
import type {
	ParseArrayFormat,
	ParseOptions,
	ValueType,
	ValueTypeError,
} from "./types";

function isArrayType(t: ValueType): t is "string[]" | "number[]" {
	return t === "string[]" || t === "number[]";
}

function isScalarType(
	t: ValueType,
): t is Exclude<ValueType, "string[]" | "number[]"> {
	return t === "string" || t === "number" || t === "boolean";
}

function toScalarType(
	t: ValueType,
): Exclude<ValueType, "string[]" | "number[]"> {
	return isArrayType(t) ? (t.slice(0, -2) as any) : t;
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
 * Cast an untyped value using global flags only.
 * Explicit `types` are handled in finalizeKey().
 */
function castValue(
	rawInput: unknown,
	parseNumber: boolean,
	parseBoolean: boolean,
): any {
	const raw = String(rawInput);

	// parseBoolean logic: only "true"/"false" (lowercase)
	if (parseBoolean) {
		const boolValue = castScalarByType(raw, "boolean");
		if (typeof boolValue === "boolean") return boolValue;
	}

	// parseNumber logic: strict check
	// "001" -> 1 (Number() behavior)
	// "1e3" -> 1000 (Number() behavior)
	// "Infinity", "NaN", "" -> no cast
	if (parseNumber) {
		const numValue = castScalarByType(raw, "number");
		if (typeof numValue === "number") return numValue;
	}

	return raw;
}

function castExplicitTypedValue(
	value: unknown,
	key: string,
	explicitType: ValueType,
	onTypeError: ValueTypeError,
): { accepted: boolean; value?: unknown } {
	const scalarType = toScalarType(explicitType);
	let casted: unknown;
	let error: string | undefined;

	if (value === null) {
		error = `Expected a value for key "${key}" of type ${explicitType}`;
	} else {
		casted = castScalarByType(String(value), scalarType);
		if (scalarType === "number" && typeof casted !== "number") {
			error = `Expected finite numbers for key "${key}", got "${String(value)}"`;
		}
		if (scalarType === "boolean" && typeof casted !== "boolean") {
			error = `Expected booleans for key "${key}", got "${String(value)}"`;
		}
	}

	if (!error) return { accepted: true, value: casted };
	if (onTypeError === "throw") throw new TypeError(error);
	if (onTypeError === "keep") return { accepted: true, value };
	return { accepted: false };
}

function finalizeKey(
	result: Record<string, any>,
	key: string,
	types: ParseOptions["types"],
	parseNumber: boolean,
	parseBoolean: boolean,
	onTypeError: ValueTypeError,
): void {
	const current = result[key];
	const explicitType = types?.[key];
	if (explicitType && isArrayType(explicitType)) {
		const values = Array.isArray(current) ? current : [current];
		const next: unknown[] = [];

		for (const value of values) {
			const out = castExplicitTypedValue(value, key, explicitType, onTypeError);
			if (out.accepted) next.push(out.value);
		}

		result[key] = next;
		return;
	}

	if (explicitType && isScalarType(explicitType)) {
		// For scalar explicit types, repeated params collapse to the last value.
		const candidate = Array.isArray(current) ? current.at(-1) : current;
		const out = castExplicitTypedValue(
			candidate,
			key,
			explicitType,
			onTypeError,
		);
		if (!out.accepted) {
			delete result[key];
			return;
		}
		result[key] = out.value;
		return;
	}

	if (Array.isArray(current)) {
		result[key] = current.map((item) =>
			item === null ? null : castValue(String(item), parseNumber, parseBoolean),
		);
		return;
	}

	if (current !== null) {
		result[key] = castValue(String(current), parseNumber, parseBoolean);
	}
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

function validateParseOptions(
	array: ParseArrayFormat,
	onTypeError: ValueTypeError,
): void {
	validateArrayFormat(array.format);
	validateOnTypeError(onTypeError);
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
		parseNumber = false,
		parseBoolean = false,
		array = { format: "repeat" },
		types,
		onTypeError = "keep",
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

	validateParseOptions(array, onTypeError);

	// -----------------------
	// Branch: format
	// -----------------------
	switch (array.format) {
		case "repeat": {
			for (const part of cleaned.split("&")) {
				if (!part) continue;

				const [rawKey, rawVal] = splitOnFirst(part, "=");

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
				finalizeKey(result, key, types, parseNumber, parseBoolean, onTypeError);
			}
			break;
		}

		case "comma": {
			// Note: split commas BEFORE decoding so "%2C" stays a literal comma and is not split.
			const splitEncoded = array.encoded === "split";

			for (const part of cleaned.split("&")) {
				if (!part) continue;

				const [rawKey, rawVal] = splitOnFirst(part, "=");

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

				finalizeKey(result, key, types, parseNumber, parseBoolean, onTypeError);
			}
			break;
		}
	}

	return result;
}
