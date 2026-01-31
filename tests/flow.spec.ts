import { describe, expect, test } from "bun:test";
import { parse } from "../src/parse";
import { stringify } from "../src/stringify";

describe("flow (round-trip)", () => {
	describe("array format: comma", () => {
		test("round-trip with encoded: preserve (preserves structure even with commas in values)", () => {
			const input = { a: ["x", "y,z"] };
			// stringify -> "a=x,y%2Cz"
			// parse (preserve) -> split on ",", keep "%2C" as is -> ["x", "y%2Cz"] ??
			// WAIT: The parser 'preserve' means: split on literal comma, treat %2C as data.
			// So parsing "a=x,y%2Cz" gives ["x", "y%2Cz"].
			// If we decode=true (default), "y%2Cz" becomes "y,z".
			// So yes, it should Round Trip!

			const encoded = stringify(input, {
				array: { format: "comma" },
			});
			const decoded = parse(encoded, {
				array: { format: "comma", encoded: "preserve" },
			});

			expect(decoded).toEqual(input);
		});

		test("round-trip with encoded: split (lossy with commas in values)", () => {
			const input = { a: ["x", "y,z"] };
			// stringify -> "a=x,y%2Cz"
			// parse (split) -> split on "," AND split on "%2C" -> ["x", "y", "z"]

			const encoded = stringify(
				input,
				{ array: { format: "comma" } }, // effectively 'preserve' in stringify
			);

			// parse with split
			const decoded = parse(encoded, {
				array: { format: "comma", encoded: "split" },
			});

			// It split "y,z" into "y" and "z" because the source had a comma (which got encoded to %2C)
			// and 'split' treats %2C as a separator.
			expect(decoded).toEqual({ a: ["x", "y", "z"] });
		});

		test("round-trip with encoded: split (safe without commas in values)", () => {
			const input = { a: ["x", "y"] };
			const encoded = stringify(input, {
				array: { format: "comma" },
			});
			const decoded = parse(encoded, {
				array: { format: "comma", encoded: "split" },
			});
			expect(decoded).toEqual(input);
		});

		test("mixed config: stringify(preserve) -> parse(split) is lossy on commas", () => {
			const input = { a: ["x", "y,z"] };
			const encoded = stringify(input, {
				array: { format: "comma" },
			});
			const decoded = parse(encoded, {
				array: { format: "comma", encoded: "split" },
			});
			expect(decoded).toEqual({ a: ["x", "y", "z"] });
		});

		test("mixed config: stringify(split) -> parse(preserve) is safe", () => {
			// stringify(split) is actually same as stringify(preserve) currently: escapes commas
			const input = { a: ["x", "y,z"] };
			const encoded = stringify(input, {
				array: { format: "comma" },
			});
			// encoded is "a=x,y%2Cz"

			const decoded = parse(encoded, {
				array: { format: "comma", encoded: "preserve" },
			});
			// parse(preserve) splits on literal comma -> ["x", "y%2Cz"]
			// decodes "y%2Cz" -> "y,z"

			expect(decoded).toEqual(input);
		});
	});
});
