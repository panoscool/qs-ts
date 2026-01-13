import { build } from "bun";

// Build ESM
await build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    target: "node",
    format: "esm",
    naming: "[name].js",
});

// Build CJS
await build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    target: "node",
    format: "cjs",
    naming: "[name].cjs",
});

// Generate Types
const proc = Bun.spawn(["bun", "x", "tsc"]);
await proc.exited;

console.log("Build complete!");
