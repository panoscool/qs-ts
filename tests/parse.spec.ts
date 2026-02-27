import { describe, expect, test } from "bun:test";
import { parse } from "../src/parse";
import type { ParseOptions } from "../src/types";

describe("parse", () => {
	test("returns empty object for empty string", () => {
		expect(parse("")).toEqual({});
	});

	test("trims and removes leading ?/#/&", () => {
		expect(parse(" ?a=1&b=2 ")).toEqual({ a: "1", b: "2" });
		expect(parse("?a=1")).toEqual({ a: "1" });
		expect(parse("#a=1")).toEqual({ a: "1" });
		expect(parse("&a=1")).toEqual({ a: "1" });
	});

	test("parses key without equals as null", () => {
		expect(parse("a")).toEqual({ a: null });
		expect(parse("a&b=1")).toEqual({ a: null, b: "1" });
	});

	test("parses empty value as empty string", () => {
		expect(parse("a=")).toEqual({ a: "" });
	});

	test("ignores empty params", () => {
		expect(parse("a=1&&b=2&")).toEqual({ a: "1", b: "2" });
	});

	test("default repeat: repeated keys become arrays", () => {
		expect(parse("a=1&a=2")).toEqual({ a: ["1", "2"] });
	});

	test("default repeat: single key stays scalar", () => {
		expect(parse("a=1")).toEqual({ a: "1" });
	});

	describe("decode option", () => {
		test("decode=true decodes key and value and + to space", () => {
			expect(parse("q=hello+world")).toEqual({ q: "hello world" });
			expect(parse("a%20b=c%26d")).toEqual({ "a b": "c&d" });
		});

		test("decode=false preserves raw encoding", () => {
			expect(parse("q=hello+world", { decode: false })).toEqual({
				q: "hello+world",
			});
			expect(parse("a%20b=c%26d", { decode: false })).toEqual({
				"a%20b": "c%26d",
			});
		});

		test("malformed encoding is safe (decode=true)", () => {
			expect(parse("a=%E0%A4%A")).toEqual({ a: "%E0%A4%A" });
		});
	});

	describe("array: repeat", () => {
		test("explicit repeat format: stringifies as repeated keys", () => {
			expect(parse("a=1&a=2", { array: { format: "repeat" } })).toEqual({
				a: ["1", "2"],
			});
		});

		test("explicit repeat format: single key stays scalar", () => {
			expect(parse("a=1", { array: { format: "repeat" } })).toEqual({ a: "1" });
		});

		test("repeat + parseNumber: parses repeated numbers", () => {
			expect(
				parse("a=1&a=2.5", {
					array: { format: "repeat" },
					parseNumber: true,
				}),
			).toEqual({ a: [1, 2.5] });
		});

		test("repeat + parseBoolean: parses repeated booleans", () => {
			expect(
				parse("a=true&a=false", {
					array: { format: "repeat" },
					parseBoolean: true,
				}),
			).toEqual({ a: [true, false] });
		});

		test("repeat + explicit types: string[] enforces array on single item", () => {
			expect(
				parse("tags=a", {
					array: { format: "repeat" },
					types: { tags: "string[]" },
				}),
			).toEqual({ tags: ["a"] });
		});

		test("repeat + explicit types: number[] parses and enforces array", () => {
			expect(
				parse("ids=1&ids=2", {
					array: { format: "repeat" },
					types: { ids: "number[]" },
				}),
			).toEqual({ ids: [1, 2] });
		});

		test("repeat + explicit types: number[] with single item", () => {
			expect(
				parse("ids=1", {
					array: { format: "repeat" },
					types: { ids: "number[]" },
				}),
			).toEqual({ ids: [1] });
		});
	});

	describe("array: comma", () => {
		test("comma keeps key without value as null", () => {
			expect(
				parse("foo", {
					array: { format: "comma", encoded: "preserve" },
				}),
			).toEqual({ foo: null });
		});

		test("comma splits into array (preserve)", () => {
			expect(
				parse("foo=a,b", {
					array: { format: "comma", encoded: "preserve" },
				}),
			).toEqual({
				foo: ["a", "b"],
			});
		});

		test("comma splits into array (split)", () => {
			expect(
				parse("foo=a,b", {
					array: { format: "comma", encoded: "split" },
				}),
			).toEqual({
				foo: ["a", "b"],
			});
		});

		test("comma trims whitespace around segments", () => {
			expect(
				parse("foo=a, b ,c", {
					array: { format: "comma", encoded: "preserve" },
				}),
			).toEqual({
				foo: ["a", "b", "c"],
			});
		});

		test("comma drops empty segments", () => {
			expect(
				parse("foo=a,,b,", {
					array: { format: "comma", encoded: "preserve" },
				}),
			).toEqual({
				foo: ["a", "b"],
			});
		});

		test("comma preserved encoded comma (%2C) when encoded: preserve", () => {
			// foo=a%2Cb means literal "a,b" not an array
			expect(
				parse("foo=a%2Cb", {
					array: { format: "comma", encoded: "preserve" },
				}),
			).toEqual({
				foo: "a,b",
			});
		});

		test("comma splits encoded comma (%2C) when encoded: split", () => {
			// foo=a%2Cb means ["a", "b"]
			expect(
				parse("foo=a%2Cb", {
					array: { format: "comma", encoded: "split" },
				}),
			).toEqual({
				foo: ["a", "b"],
			});
		});

		test("comma splits encoded comma (%2c) case insensitive when encoded: split", () => {
			expect(
				parse("foo=a%2cb", {
					array: { format: "comma", encoded: "split" },
				}),
			).toEqual({
				foo: ["a", "b"],
			});
		});

		test("comma + repeated keys flattens", () => {
			expect(
				parse("foo=a,b&foo=c", {
					array: { format: "comma", encoded: "preserve" },
				}),
			).toEqual({
				foo: ["a", "b", "c"],
			});
		});

		test("comma + repeated comma values flattens", () => {
			expect(
				parse("foo=a,b&foo=c,d", {
					array: { format: "comma", encoded: "preserve" },
				}),
			).toEqual({
				foo: ["a", "b", "c", "d"],
			});
		});

		test("comma single token remains scalar unless types enforces array", () => {
			expect(
				parse("foo=a", {
					array: { format: "comma", encoded: "preserve" },
				}),
			).toEqual({ foo: "a" });
		});
	});

	describe("types option", () => {
		test("types: unknown type falls back to raw string", () => {
			expect(
				parse("a=1", {
					types: { a: "unknown" as any },
				} as any),
			).toEqual({ a: "1" });
		});

		test("types: number casts scalar", () => {
			expect(
				parse("a=1&b=12.34&c=0", {
					types: { a: "number", b: "number", c: "number" },
				}),
			).toEqual({
				a: 1,
				b: 12.34,
				c: 0,
			});
		});

		test("types: boolean casts only true/false, otherwise falls back to string", () => {
			expect(
				parse("a=true&b=false&c=yes", {
					types: { a: "boolean", b: "boolean", c: "boolean" },
				}),
			).toEqual({
				a: true,
				b: false,
				c: "yes",
			});
		});

		test("types: string keeps as string", () => {
			expect(parse("a=1", { types: { a: "string" } })).toEqual({ a: "1" });
		});

		test("types: number[] enforces array on single token", () => {
			expect(parse("ids=1", { types: { ids: "number[]" } })).toEqual({
				ids: [1],
			});
		});

		test("types: string[] enforces array on single token", () => {
			expect(parse("tags=a", { types: { tags: "string[]" } })).toEqual({
				tags: ["a"],
			});
		});

		test("types: number[] works with comma arrays", () => {
			expect(
				parse("ids=1,2,3", {
					array: { format: "comma", encoded: "preserve" },
					types: { ids: "number[]" },
				}),
			).toEqual({ ids: [1, 2, 3] });
		});

		test("types: number[] works with repeated keys", () => {
			expect(parse("ids=1&ids=2", { types: { ids: "number[]" } })).toEqual({
				ids: [1, 2],
			});
		});

		test("types: number[] keeps invalid values by default", () => {
			expect(parse("ids", { types: { ids: "number[]" } })).toEqual({
				ids: [null],
			});
		});

		test("types: number[] keeps non-finite values by default", () => {
			expect(parse("ids=1&ids=NaN", { types: { ids: "number[]" } })).toEqual({
				ids: [1, "NaN"],
			});
		});

		test("types: string[] keeps missing values by default", () => {
			expect(parse("tags", { types: { tags: "string[]" } })).toEqual({
				tags: [null],
			});
		});

		test("types + onTypeError=throw throws on invalid typed array values", () => {
			expect(() =>
				parse("ids=1&ids=NaN", {
					types: { ids: "number[]" },
					onTypeError: "throw",
				}),
			).toThrow(TypeError);
		});

		test("types + onTypeError=drop drops invalid typed array values", () => {
			expect(
				parse("ids=1&ids=NaN&ids=2", {
					types: { ids: "number[]" },
					onTypeError: "drop",
				}),
			).toEqual({ ids: [1, 2] });
		});

		test("types + onTypeError=drop keeps empty typed array key", () => {
			expect(
				parse("ids=NaN", {
					types: { ids: "number[]" },
					onTypeError: "drop",
				}),
			).toEqual({ ids: [] });
		});

		test("types + onTypeError=throw throws for invalid scalar number", () => {
			expect(() =>
				parse("a=NaN", {
					types: { a: "number" },
					onTypeError: "throw",
				}),
			).toThrow(TypeError);
		});

		test("types + onTypeError=drop removes invalid scalar number key", () => {
			expect(
				parse("a=NaN&b=2", {
					types: { a: "number", b: "number" },
					onTypeError: "drop",
				}),
			).toEqual({ b: 2 });
		});

		test("types + onTypeError=drop removes invalid scalar boolean key", () => {
			expect(
				parse("flag=yes", {
					types: { flag: "boolean" },
					onTypeError: "drop",
				}),
			).toEqual({});
		});

		test("types + onTypeError=keep preserves invalid scalar boolean value", () => {
			expect(
				parse("flag=yes", {
					types: { flag: "boolean" },
					onTypeError: "keep",
				}),
			).toEqual({ flag: "yes" });
		});

		test("scalar typed keys with repeated params use last value", () => {
			expect(parse("a=1&a=2", { types: { a: "number" } })).toEqual({ a: 2 });
		});

		test("scalar typed keys + onTypeError=throw validates repeated last value", () => {
			expect(() =>
				parse("a=1&a=NaN", {
					types: { a: "number" },
					onTypeError: "throw",
				}),
			).toThrow(TypeError);
		});

		test("scalar typed keys + onTypeError=drop can remove repeated key", () => {
			expect(
				parse("a=1&a=NaN", {
					types: { a: "number" },
					onTypeError: "drop",
				}),
			).toEqual({});
		});

		test("throws on invalid onTypeError value", () => {
			expect(() => parse("a=1", { onTypeError: "invalid" as any })).toThrow(
				TypeError,
			);
		});

		test("types override global parse flags for those keys", () => {
			const opts: ParseOptions = {
				parseNumber: true,
				types: { a: "string", b: "string", c: "number" },
			};

			expect(parse("a=1&b=true&c=10", opts)).toEqual({
				a: "1",
				b: "true",
				c: 10,
			});
		});

		test("throws on invalid array", () => {
			expect(() =>
				parse("a=1", { array: { format: "invalid" as any } }),
			).toThrow(TypeError);
		});
	});

	describe("parseNumber option", () => {
		test("parses standard numbers", () => {
			expect(parse("a=1&b=12.34&c=-5", { parseNumber: true })).toEqual({
				a: 1,
				b: 12.34,
				c: -5,
			});
		});

		test("parses scientific notation", () => {
			expect(parse("a=1e3", { parseNumber: true })).toEqual({ a: 1000 });
		});

		test("parses leading zeros (interprets as decimal per Number())", () => {
			expect(parse("a=001", { parseNumber: true })).toEqual({ a: 1 });
		});

		test("does not parse Infinity or NaN", () => {
			expect(
				parse("a=Infinity&b=NaN&c=-Infinity", { parseNumber: true }),
			).toEqual({
				a: "Infinity",
				b: "NaN",
				c: "-Infinity",
			});
		});

		test("does not parse empty string or whitespace", () => {
			expect(parse("b=  &a=", { parseNumber: true })).toEqual({
				b: "  ",
				a: "",
			});
		});

		test("does not parse mixed content", () => {
			expect(parse("a=12a&b=a12", { parseNumber: true })).toEqual({
				a: "12a",
				b: "a12",
			});
		});
	});

	describe("parseBoolean option", () => {
		test("parses true/false", () => {
			expect(parse("a=true&b=false", { parseBoolean: true })).toEqual({
				a: true,
				b: false,
			});
		});

		test("does not parse mixed case or uppercase", () => {
			expect(parse("a=TRUE&b=False&c=True", { parseBoolean: true })).toEqual({
				a: "TRUE",
				b: "False",
				c: "True",
			});
		});

		test("does not parse 1/0 as booleans", () => {
			expect(parse("a=1&b=0", { parseBoolean: true })).toEqual({
				a: "1",
				b: "0",
			});
		});
	});

	describe("Priority Rules", () => {
		test("comma format respects explicit scalar vs array types per key", () => {
			expect(
				parse("search=hello,world&tags=hi,there", {
					array: { format: "comma", encoded: "split" },
					types: { search: "string", tags: "string[]" },
				}),
			).toEqual({
				search: "hello,world",
				tags: ["hi", "there"],
			});
		});

		test("types[key] wins over parseNumber", () => {
			// Explicitly string, even though it looks like a number and parseNumber is true
			expect(
				parse("id=123", { types: { id: "string" }, parseNumber: true }),
			).toEqual({ id: "123" });
		});

		test("types[key] wins over parseBoolean", () => {
			// Explicitly string, even though it looks like a boolean and parseBoolean is true
			expect(
				parse("flag=true", { types: { flag: "string" }, parseBoolean: true }),
			).toEqual({ flag: "true" });
		});

		test("parseBoolean treats 'true' as boolean, while parseNumber ignores it", () => {
			expect(
				parse("a=true", { parseNumber: true, parseBoolean: true }),
			).toEqual({ a: true });
		});

		test("parseNumber treats '1' as number, parseBoolean ignores it", () => {
			expect(parse("a=1", { parseNumber: true, parseBoolean: true })).toEqual({
				a: 1,
			});
		});
	});

	test("prevents prototype pollution", () => {
		const result = parse("__proto__=evil");
		expect(result).toHaveProperty("__proto__", "evil");
		expect(Object.prototype.hasOwnProperty).toBeDefined();
	});

	test("handles constructor key safely", () => {
		expect(parse("constructor=evil")).toEqual({ constructor: "evil" });
	});
});
