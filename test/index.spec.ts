import { describe, test, expect } from "bun:test";
import * as lib from "../src/index";

describe("index exports", () => {
    test("exports parse and stringify", () => {
        expect(typeof lib.parse).toBe("function");
        expect(typeof lib.stringify).toBe("function");
    });

    test("exports core helpers", () => {
        expect(typeof lib.splitOnFirst).toBe("function");
        expect(typeof lib.safeDecodeURIComponent).toBe("function");
        expect(typeof lib.strictUriEncode).toBe("function");
    });

    test("parse and stringify work via index", () => {
        expect(lib.parse("a=1")).toEqual({ a: "1" });
        expect(lib.stringify({ a: "1" })).toBe("a=1");
    });
});
