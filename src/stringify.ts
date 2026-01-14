import { strictUriEncode } from "./core";
import type { StringifyOptions } from "./types";

function encodeText(text: string, encode: boolean): string {
	return encode ? strictUriEncode(text) : text;
}

function encodeValue(
	value: string | number | boolean,
	encode: boolean,
): string {
	return encodeText(String(value), encode);
}

function shouldSkipScalar(
	value: any,
	skipNull: boolean,
	skipEmptyString: boolean,
): boolean {
	if (value === undefined) return true; // always skipped
	if (value === null) return skipNull;
	if (value === "" && skipEmptyString) return true;
	return false;
}

function normalizeArrayItems(items: any[]): any[] {
	// Undefined always skipped at item-level too.
	return items.filter((v) => v !== undefined);
}

export function stringify(
	object: Record<string, any>,
	options: StringifyOptions = {},
): string {
	if (!object) return "";

	const {
		encode = true,
		arrayFormat = "repeat",
		skipNull = false,
		skipEmptyString = false,
	} = options;

	const parts: string[] = [];

	for (const key of Object.keys(object)) {
		const value = object[key];

		// ---- scalar: undefined/null/empty rules ----
		if (value === undefined) continue;

		if (value === null) {
			if (skipNull) continue;
			// Convention: null becomes "key" (no equals)
			parts.push(encodeText(key, encode));
			continue;
		}

		if (value === "" && skipEmptyString) continue;

		// ---- arrays ----
		if (Array.isArray(value)) {
			const items = normalizeArrayItems(value);

			if (arrayFormat === "repeat") {
				// key=a&key=b
				for (const item of items) {
					if (shouldSkipScalar(item, skipNull, skipEmptyString)) continue;

					if (item === null) {
						// Convention: null item becomes "key"
						parts.push(encodeText(key, encode));
					} else {
						parts.push(
							`${encodeText(key, encode)}=${encodeValue(item, encode)}`,
						);
					}
				}
				continue;
			}

			if (arrayFormat === "bracket") {
				// key[]=a&key[]=b
				const keyWithBrackets = `${key}[]`;

				for (const item of items) {
					if (shouldSkipScalar(item, skipNull, skipEmptyString)) continue;

					if (item === null) {
						// Convention: null item becomes "key[]"
						parts.push(encodeText(keyWithBrackets, encode));
					} else {
						parts.push(
							`${encodeText(keyWithBrackets, encode)}=${encodeValue(item, encode)}`,
						);
					}
				}
				continue;
			}

			if (arrayFormat === "comma") {
				// key=a,b
				const encodedItems: string[] = [];

				for (const item of items) {
					if (shouldSkipScalar(item, skipNull, skipEmptyString)) continue;
					if (item === null) continue; // avoid empty segments; consistent with parse dropping empties

					encodedItems.push(encodeValue(item, encode));
				}

				if (encodedItems.length === 0) continue;

				parts.push(`${encodeText(key, encode)}=${encodedItems.join(",")}`);
				continue;
			}

			// If TypeScript ever allows other values, we still keep runtime safe:
			continue;
		}

		// ---- scalar normal ----
		parts.push(`${encodeText(key, encode)}=${encodeValue(value, encode)}`);
	}

	return parts.join("&");
}
