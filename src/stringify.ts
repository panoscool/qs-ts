import { strictUriEncode } from "./core.js";
import type { StringifyOptions } from "./types.js";

function enc(text: string, options: StringifyOptions): string {
    return options.encode === false ? text : strictUriEncode(text);
}

function encValue(v: string | number | boolean, options: StringifyOptions): string {
    return enc(String(v), options);
}

export function stringify(object: Record<string, any>, options: StringifyOptions = {}): string {
    if (!object) return "";

    const opts: Required<Pick<StringifyOptions, "encode" | "arrayFormat" | "skipNull" | "skipEmptyString">> &
        StringifyOptions = {
        encode: true,
        arrayFormat: "repeat",
        skipNull: false,
        skipEmptyString: false,
        ...options,
    };

    const parts: string[] = [];

    for (const key of Object.keys(object)) {
        const value = object[key];

        // undefined is always skipped
        if (value === undefined) continue;

        // null scalar
        if (value === null) {
            if (opts.skipNull) continue;
            // keep your current convention: "a" means null
            parts.push(enc(key, opts));
            continue;
        }

        // empty string scalar
        if (value === "" && opts.skipEmptyString) continue;

        // arrays
        if (Array.isArray(value)) {
            const items = value.filter((v) => v !== undefined);

            if (opts.arrayFormat === "comma") {
                const encodedItems = items
                    .filter((item) => !(item === null && opts.skipNull))
                    .filter((item) => !(item === "" && opts.skipEmptyString))
                    .map((item) => (item === null ? "" : encValue(item, opts)));

                // drop empty segments (avoids leading/trailing commas)
                const cleaned = encodedItems.filter((s) => s.length > 0);
                if (cleaned.length === 0) continue;

                parts.push(`${enc(key, opts)}=${cleaned.join(",")}`);
                continue;
            }

            if (opts.arrayFormat === "bracket") {
                const keyWithBrackets = `${key}[]`;
                const sub = items
                    .filter((item) => !(item === null && opts.skipNull))
                    .filter((item) => !(item === "" && opts.skipEmptyString))
                    .map((item) => {
                        if (item === null) return enc(keyWithBrackets, opts); // "a[]"
                        return `${enc(keyWithBrackets, opts)}=${encValue(item, opts)}`;
                    });

                parts.push(...sub);
                continue;
            }

            // repeat (default)
            const sub = items
                .filter((item) => !(item === null && opts.skipNull))
                .filter((item) => !(item === "" && opts.skipEmptyString))
                .map((item) => {
                    if (item === null) return enc(key, opts); // "a"
                    return `${enc(key, opts)}=${encValue(item, opts)}`;
                });

            parts.push(...sub);
            continue;
        }

        // scalar normal
        parts.push(`${enc(key, opts)}=${encValue(value, opts)}`);
    }

    return parts.join("&");
}
