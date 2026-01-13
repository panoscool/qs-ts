import { describe, test, expect } from "bun:test";
import { splitOnFirst, safeDecodeURIComponent, strictUriEncode } from "../src/core";

describe("core", () => {
    describe("splitOnFirst", () => {
        test("splits on first occurrence", () => {
            expect(splitOnFirst("a=b=c", "=")).toEqual(["a", "b=c"]);
        });

        test("returns original when separator not found", () => {
            expect(splitOnFirst("abc", "=")).toEqual(["abc", undefined]);
        });

        test("returns [string, undefined] when separator is empty", () => {
            expect(splitOnFirst("abc", "")).toEqual(["abc", undefined]);
        });

        test("works with multi-char separator", () => {
            expect(splitOnFirst("a--b--c", "--")).toEqual(["a", "b--c"]);
        });
    });

    describe("safeDecodeURIComponent", () => {
        test("decodes percent encoding", () => {
            expect(safeDecodeURIComponent("%20")).toBe(" ");
            expect(safeDecodeURIComponent("%2B")).toBe("+");
            expect(safeDecodeURIComponent("a%26b")).toBe("a&b");
        });

        test("converts + to space", () => {
            expect(safeDecodeURIComponent("hello+world")).toBe("hello world");
        });

        test("returns input on malformed encoding", () => {
            expect(safeDecodeURIComponent("%E0%A4%A")).toBe("%E0%A4%A");
        });
    });

    describe("strictUriEncode", () => {
        test("encodes space as %20", () => {
            expect(strictUriEncode(" ")).toBe("%20");
        });

        test("encodes + as %2B and & as %26", () => {
            expect(strictUriEncode("+")).toBe("%2B");
            expect(strictUriEncode("&")).toBe("%26");
        });

        test("encodes RFC3986 reserved characters !'()*", () => {
            expect(strictUriEncode("!")).toBe("%21");
            expect(strictUriEncode("'")).toBe("%27");
            expect(strictUriEncode("(")).toBe("%28");
            expect(strictUriEncode(")")).toBe("%29");
            expect(strictUriEncode("*")).toBe("%2A");
        });

        test("leaves unreserved characters", () => {
            expect(strictUriEncode("abc-_.~")).toBe("abc-_.~");
        });
    });
});
