import { describe, test, expect } from "bun:test";
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
            expect(parse("q=hello+world", { decode: false })).toEqual({ q: "hello+world" });
            expect(parse("a%20b=c%26d", { decode: false })).toEqual({ "a%20b": "c%26d" });
        });

        test("malformed encoding is safe (decode=true)", () => {
            expect(parse("a=%E0%A4%A")).toEqual({ a: "%E0%A4%A" });
        });
    });

    describe("arrayFormat: bracket", () => {
        test("bracket keys normalize foo[] -> foo", () => {
            expect(parse("foo[]=a&foo[]=b", { arrayFormat: "bracket" })).toEqual({ foo: ["a", "b"] });
        });

        test("bracket single item yields array", () => {
            expect(parse("foo[]=a", { arrayFormat: "bracket" })).toEqual({ foo: ["a"] });
        });

        test("bracket and non-bracket keys are treated based on normalization rule", () => {
            // With normalization, foo[]=a and foo=b both accumulate into foo
            expect(parse("foo[]=a&foo=b", { arrayFormat: "bracket" })).toEqual({ foo: ["a", "b"] });
        });
    });

    describe("arrayFormat: comma", () => {
        test("comma splits into array", () => {
            expect(parse("foo=a,b", { arrayFormat: "comma" })).toEqual({ foo: ["a", "b"] });
        });

        test("comma trims whitespace around segments", () => {
            expect(parse("foo=a, b ,c", { arrayFormat: "comma" })).toEqual({ foo: ["a", "b", "c"] });
        });

        test("comma drops empty segments", () => {
            expect(parse("foo=a,,b,", { arrayFormat: "comma" })).toEqual({ foo: ["a", "b"] });
        });

        test("comma does NOT split encoded comma (%2C)", () => {
            // foo=a%2Cb means literal "a,b" not an array
            expect(parse("foo=a%2Cb", { arrayFormat: "comma" })).toEqual({ foo: "a,b" });
        });

        test("comma + repeated keys flattens", () => {
            expect(parse("foo=a,b&foo=c", { arrayFormat: "comma" })).toEqual({ foo: ["a", "b", "c"] });
        });

        test("comma + repeated comma values flattens", () => {
            expect(parse("foo=a,b&foo=c,d", { arrayFormat: "comma" })).toEqual({ foo: ["a", "b", "c", "d"] });
        });

        test("comma single token remains scalar unless types enforces array", () => {
            expect(parse("foo=a", { arrayFormat: "comma" })).toEqual({ foo: "a" });
        });
    });

    describe("types option", () => {
        test("types: number casts scalar", () => {
            expect(parse("a=1&b=12.34&c=0", { types: { a: "number", b: "number", c: "number" } })).toEqual({
                a: 1,
                b: 12.34,
                c: 0,
            });
        });

        test("types: boolean casts only true/false, otherwise falls back to string", () => {
            expect(parse("a=true&b=false&c=yes", { types: { a: "boolean", b: "boolean", c: "boolean" } })).toEqual({
                a: true,
                b: false,
                c: "yes",
            });
        });

        test("types: string keeps as string", () => {
            expect(parse("a=1", { types: { a: "string" } })).toEqual({ a: "1" });
        });

        test("types: number[] enforces array on single token", () => {
            expect(parse("ids=1", { types: { ids: "number[]" } })).toEqual({ ids: [1] });
        });

        test("types: string[] enforces array on single token", () => {
            expect(parse("tags=a", { types: { tags: "string[]" } })).toEqual({ tags: ["a"] });
        });

        test("types: number[] works with comma arrays", () => {
            expect(parse("ids=1,2,3", { arrayFormat: "comma", types: { ids: "number[]" } })).toEqual({ ids: [1, 2, 3] });
        });

        test("types: number[] works with repeated keys", () => {
            expect(parse("ids=1&ids=2", { types: { ids: "number[]" } })).toEqual({ ids: [1, 2] });
        });

        test("types override inferTypes for those keys", () => {
            const opts: ParseOptions = {
                inferTypes: true,
                types: { a: "string", b: "string", c: "number" },
            };

            expect(parse("a=1&b=true&c=10", opts)).toEqual({
                a: "1",
                b: "true",
                c: 10,
            });
        });
    });

    describe("inferTypes option", () => {
        test("inferTypes parses booleans, numbers, null", () => {
            expect(parse("a=true&b=false&c=123&d=12.34&e=0&f=null&g=foo", { inferTypes: true })).toEqual({
                a: true,
                b: false,
                c: 123,
                d: 12.34,
                e: 0,
                f: null,
                g: "foo",
            });
        });

        test("inferTypes does not convert empty string", () => {
            expect(parse("a=&b=", { inferTypes: true })).toEqual({ a: "", b: "" });
        });

        test("inferTypes leaves non-numeric strings", () => {
            expect(parse("a=12a", { inferTypes: true })).toEqual({ a: "12a" });
        });

        test("inferTypes handles leading zeros according to Number()", () => {
            expect(parse("a=001", { inferTypes: true })).toEqual({ a: 1 });
        });
    });
});
