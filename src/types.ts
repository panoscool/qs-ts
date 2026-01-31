/**
 * 	encoded: "preserve" splits on literal , only; %2C is treated as data.
 * 	encoded: "split" splits on literal , and on %2C/%2c so results don’t depend on upstream encoding.
 */
type CommaEncoded = "preserve" | "split";

export type ParseArrayFormat =
	| { format: "repeat" }
	| { format: "comma"; encoded: CommaEncoded };

export type StringifyArrayFormat = Omit<ParseArrayFormat, "encoded">;

export type ArrayFormat = ParseArrayFormat | StringifyArrayFormat;

export type ValueType =
	| "string"
	| "number"
	| "boolean"
	| "string[]"
	| "number[]";

export type ParseOptions = {
	decode?: boolean;
	array?: ParseArrayFormat;
	parseNumber?: boolean;
	parseBoolean?: boolean;
	types?: Record<string, ValueType>;
};

export type StringifyOptions = {
	encode?: boolean;
	array?: StringifyArrayFormat;
	skipNull?: boolean;
	skipEmptyString?: boolean;
};
