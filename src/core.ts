export const ARRAY_FORMATS = ["repeat", "comma"];
export const TYPE_ERRORS = ["keep", "throw", "drop"];

export function splitOnFirst(
	string: string,
	separator: string,
): [string, string | undefined] {
	if (!(typeof string === "string" && typeof separator === "string")) {
		throw new TypeError("Expected the arguments to be of type `string`");
	}

	if (separator === "") {
		return [string, undefined];
	}

	const separatorIndex = string.indexOf(separator);

	if (separatorIndex === -1) {
		return [string, undefined];
	}

	return [
		string.slice(0, separatorIndex),
		string.slice(separatorIndex + separator.length),
	];
}

export function safeDecodeURIComponent(text: string): string {
	try {
		return decodeURIComponent(text.replace(/\+/g, " "));
	} catch {
		return text;
	}
}

export function strictUriEncode(text: string): string {
	return encodeURIComponent(text).replace(
		/[!'()*]/g,
		(c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}

export function decodeText(text: string, decode: boolean): string {
	return decode ? safeDecodeURIComponent(text) : text;
}

export function encodeText(text: string, encode: boolean): string {
	return encode ? strictUriEncode(text) : text;
}

export function splitCommaRaw(raw: string): string[] {
	return raw
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
}

export function validateArrayFormat(arrayFormat: string): void {
	if (!ARRAY_FORMATS.includes(arrayFormat)) {
		throw new TypeError(
			`Invalid array format: ${arrayFormat}. Must be one of: ${ARRAY_FORMATS.join(", ")}`,
		);
	}
}

export function validateOnTypeError(onTypeError: string): void {
	if (!TYPE_ERRORS.includes(onTypeError)) {
		throw new TypeError(
			`Invalid onTypeError: ${onTypeError}. Must be one of: ${TYPE_ERRORS.join(", ")}`,
		);
	}
}
