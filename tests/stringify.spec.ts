import { describe, test, expect } from "bun:test";
import { stringify } from "../src/stringify";

describe("stringify", () => {
    test("returns empty string for empty object", () => {
        expect(stringify({})).toBe("");
    });

    test("returns empty string for falsy object", () => {
        // @ts-expect-error testing runtime guard
        expect(stringify(null)).toBe("");
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
            // matches your current convention and parse("a") => null
            expect(stringify({ a: null, b: "x" }, { skipNull: false })).toBe("a&b=x");
        });

        test("skipEmptyString=true removes empty strings", () => {
            expect(stringify({ a: "", b: "x" }, { skipEmptyString: true })).toBe("b=x");
        });

        test("skipEmptyString=false keeps empty string as a=", () => {
            expect(stringify({ a: "", b: "x" }, { skipEmptyString: false })).toBe("a=&b=x");
        });
    });

    describe("arrays: repeat (default)", () => {
        test("repeat arrays stringify as repeated keys", () => {
            expect(stringify({ a: ["x", "y"] })).toBe("a=x&a=y");
        });

        test("repeat arrays skip undefined items", () => {
            expect(stringify({ a: ["x", undefined, "y"] })).toBe("a=x&a=y");
        });

        test("repeat arrays skip null items when skipNull=true", () => {
            expect(stringify({ a: ["x", null, "y"] }, { skipNull: true })).toBe("a=x&a=y");
        });

        test("repeat arrays keep null items as key only when skipNull=false", () => {
            expect(stringify({ a: ["x", null, "y"] }, { skipNull: false })).toBe("a=x&a&a=y");
        });

        test("repeat arrays skip empty items when skipEmptyString=true", () => {
            expect(stringify({ a: ["x", "", "y"] }, { skipEmptyString: true })).toBe("a=x&a=y");
        });

        test("does not produce double ampersands", () => {
            expect(stringify({ a: ["x", null, "y"] }, { skipNull: true })).not.toContain("&&");
            expect(stringify({ a: ["x", "", "y"] }, { skipEmptyString: true })).not.toContain("&&");
        });
    });

    describe("arrays: bracket", () => {
        test("bracket arrays stringify as key[]=x&key[]=y", () => {
            expect(stringify({ a: ["x", "y"] }, { arrayFormat: "bracket" })).toBe("a%5B%5D=x&a%5B%5D=y");
        });

        test("bracket arrays skip undefined items", () => {
            expect(stringify({ a: ["x", undefined, "y"] }, { arrayFormat: "bracket" })).toBe("a%5B%5D=x&a%5B%5D=y");
        });

        test("bracket arrays skip null items when skipNull=true", () => {
            expect(stringify({ a: ["x", null, "y"] }, { arrayFormat: "bracket", skipNull: true })).toBe(
                "a%5B%5D=x&a%5B%5D=y"
            );
        });

        test("bracket arrays keep null items as key[] only when skipNull=false", () => {
            expect(stringify({ a: ["x", null, "y"] }, { arrayFormat: "bracket", skipNull: false })).toBe(
                "a%5B%5D=x&a%5B%5D&a%5B%5D=y"
            );
        });

        test("bracket arrays skip empty items when skipEmptyString=true", () => {
            expect(stringify({ a: ["x", "", "y"] }, { arrayFormat: "bracket", skipEmptyString: true })).toBe(
                "a%5B%5D=x&a%5B%5D=y"
            );
        });

        test("does not produce double ampersands", () => {
            expect(stringify({ a: ["x", null, "y"] }, { arrayFormat: "bracket", skipNull: true })).not.toContain("&&");
            expect(stringify({ a: ["x", "", "y"] }, { arrayFormat: "bracket", skipEmptyString: true })).not.toContain("&&");
        });
    });

    describe("arrays: comma", () => {
        test("comma arrays stringify as key=x,y", () => {
            expect(stringify({ a: ["x", "y"] }, { arrayFormat: "comma" })).toBe("a=x,y");
        });

        test("comma arrays encode items individually", () => {
            expect(stringify({ a: ["a b", "c&d"] }, { arrayFormat: "comma" })).toBe("a=a%20b,c%26d");
        });

        test("comma arrays skip undefined items", () => {
            expect(stringify({ a: ["x", undefined, "y"] }, { arrayFormat: "comma" })).toBe("a=x,y");
        });

        test("comma arrays skip null items when skipNull=true", () => {
            expect(stringify({ a: ["x", null, "y"] }, { arrayFormat: "comma", skipNull: true })).toBe("a=x,y");
        });

        test("comma arrays skip empty items when skipEmptyString=true", () => {
            expect(stringify({ a: ["x", "", "y"] }, { arrayFormat: "comma", skipEmptyString: true })).toBe("a=x,y");
        });

        test("comma arrays omit entirely if all items removed", () => {
            expect(stringify({ a: [null, undefined, ""] }, { arrayFormat: "comma", skipNull: true, skipEmptyString: true })).toBe("");
        });
    });
});
