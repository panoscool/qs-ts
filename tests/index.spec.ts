import { describe, expect, test } from "bun:test";
import qsDefault, { parse, stringify } from "../src/index";

describe("index exports", () => {
	test("named and default exports are available", () => {
		expect(typeof parse).toBe("function");
		expect(typeof stringify).toBe("function");
		expect(typeof qsDefault.parse).toBe("function");
		expect(typeof qsDefault.stringify).toBe("function");
	});

	test("named and default exports behave the same", () => {
		expect(parse("a=1")).toEqual({ a: "1" });
		expect(qsDefault.parse("a=1")).toEqual({ a: "1" });
		expect(stringify({ a: "1" })).toBe("a=1");
		expect(qsDefault.stringify({ a: "1" })).toBe("a=1");
	});
});
