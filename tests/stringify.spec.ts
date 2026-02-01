import { describe, expect, test } from "bun:test";
import { stringify } from "../src/stringify";

describe("stringify", () => {
	test("returns empty string for empty object", () => {
		expect(stringify({})).toBe("");
	});

	test("returns empty string for falsy object", () => {
		expect(stringify(null as any)).toBe("");
	});

	test("returns empty string for array input", () => {
		expect(stringify([] as any)).toBe("");
	});

	test("skips empty array values", () => {
		expect(stringify({ a: [] })).toBe("");
	});

	test("stringifies simple scalars", () => {
		expect(stringify({ a: "1", b: "two" })).toBe("a=1&b=two");
		expect(stringify({ a: 1, b: true, c: false })).toBe("a=1&b=true&c=false");
	});

	describe("encode option", () => {
		test("encode=true encodes reserved characters", () => {
			expect(stringify({ a: " " })).toBe("a=%20");
			expect(stringify({ a: "&" })).toBe("a=%26");
			expect(stringify({ a: "+" })).toBe("a=%2B");
		});

		test("encode=false leaves as-is", () => {
			expect(stringify({ a: " " }, { encode: false })).toBe("a= ");
			expect(stringify({ a: "&" }, { encode: false })).toBe("a=&");
		});
	});

	describe("undefined/null/empty handling", () => {
		test("undefined is always skipped", () => {
			expect(stringify({ a: undefined, b: "x" })).toBe("b=x");
		});

		test("skipNull=true removes null", () => {
			expect(stringify({ a: null, b: "x" }, { skipNull: true })).toBe("b=x");
		});

		test("skipNull=false keeps null as key only (a)", () => {
			expect(stringify({ a: null, b: "x" }, { skipNull: false })).toBe("a&b=x");
		});

		test("skipEmptyString=true removes empty strings", () => {
			expect(stringify({ a: "", b: "x" }, { skipEmptyString: true })).toBe(
				"b=x",
			);
		});

		test("skipEmptyString=false keeps empty string as a=", () => {
			expect(stringify({ a: "", b: "x" }, { skipEmptyString: false })).toBe(
				"a=&b=x",
			);
		});
	});

	describe("arrays: repeat (default & explicit)", () => {
		test("repeat (implicit): stringifies as repeated keys", () => {
			expect(stringify({ a: ["x", "y"] })).toBe("a=x&a=y");
		});

		test("repeat (explicit): stringifies as repeated keys", () => {
			expect(
				stringify({ a: ["x", "y"] }, { array: { format: "repeat" } }),
			).toBe("a=x&a=y");
		});

		test("repeat: stringifies mixed types (numbers/booleans)", () => {
			expect(stringify({ a: [1, true, "s"] })).toBe("a=1&a=true&a=s");
		});

		test("repeat: skips undefined", () => {
			expect(stringify({ a: ["x", undefined, "y"] })).toBe("a=x&a=y");
		});

		test("repeat: skips null when skipNull=true", () => {
			expect(stringify({ a: ["x", null, "y"] }, { skipNull: true })).toBe(
				"a=x&a=y",
			);
		});

		test("repeat: keeps null as key only when skipNull=false", () => {
			expect(stringify({ a: ["x", null, "y"] }, { skipNull: false })).toBe(
				"a=x&a&a=y",
			);
		});

		test("repeat: skips empty strings when skipEmptyString=true", () => {
			expect(stringify({ a: ["x", "", "y"] }, { skipEmptyString: true })).toBe(
				"a=x&a=y",
			);
		});

		test("does not produce double ampersands", () => {
			expect(
				stringify({ a: ["x", null, "y"] }, { skipNull: true }),
			).not.toContain("&&");
			expect(
				stringify({ a: ["x", "", "y"] }, { skipEmptyString: true }),
			).not.toContain("&&");
		});
	});

	describe("arrays: comma", () => {
		test("comma arrays stringify as key=x,y", () => {
			expect(stringify({ a: ["x", "y"] }, { array: { format: "comma" } })).toBe(
				"a=x,y",
			);
		});

		test("comma arrays encode items individually", () => {
			expect(
				stringify({ a: ["a b", "c&d"] }, { array: { format: "comma" } }),
			).toBe("a=a%20b,c%26d");
		});

		test("comma arrays skip undefined items", () => {
			expect(
				stringify({ a: ["x", undefined, "y"] }, { array: { format: "comma" } }),
			).toBe("a=x,y");
		});

		test("comma arrays skip null items when skipNull=true", () => {
			expect(
				stringify(
					{ a: ["x", null, "y"] },
					{
						array: { format: "comma" },
						skipNull: true,
					},
				),
			).toBe("a=x,y");
		});

		test("comma arrays skip empty items when skipEmptyString=true", () => {
			expect(
				stringify(
					{ a: ["x", "", "y"] },
					{
						array: { format: "comma" },
						skipEmptyString: true,
					},
				),
			).toBe("a=x,y");
		});

		test("comma arrays omit entirely if all items removed", () => {
			expect(
				stringify(
					{ a: [null, undefined, ""] },
					{
						array: { format: "comma" },
						skipNull: true,
						skipEmptyString: true,
					},
				),
			).toBe("");
		});
	});

	test("unknown array format is ignored (runtime safe)", () => {
		expect(
			stringify({ a: ["x"] }, { array: { format: "unknown" as any } }),
		).toBe("");
	});

	test("handles object values by converting to string", () => {
		expect(stringify({ a: { b: 1 } })).toBe("a=%5Bobject%20Object%5D");
	});

	test("handles array of objects", () => {
		expect(
			stringify({ a: [{ b: 1 }, { c: 2 }] }, { array: { format: "repeat" } }),
		).toBe("a=%5Bobject%20Object%5D&a=%5Bobject%20Object%5D");
	});

	test("nested objects are not supported - flattened to string", () => {
		expect(stringify({ user: { name: "John", age: 30 } })).toBe(
			"user=%5Bobject%20Object%5D",
		);
	});
});
