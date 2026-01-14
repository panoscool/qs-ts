import { build } from "bun";
import { rmSync } from "node:fs";

function assertBuild(result: Awaited<ReturnType<typeof build>>, label: string) {
    if (!result.success) {
        console.error(`\n❌ ${label} failed\n`);
        for (const log of result.logs) console.error(log);
        process.exit(1);
    }
}

rmSync("./dist", { recursive: true, force: true });

// Build ESM
const esm = await build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    target: "node",
    format: "esm",
    naming: "[name].js",
});
assertBuild(esm, "ESM build");

// Build CJS
const cjs = await build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    target: "node",
    format: "cjs",
    naming: "[name].cjs",
});
assertBuild(cjs, "CJS build");

// Generate Types (single tsconfig, override noEmit)
const tsc = Bun.spawn([
    "tsc",
    "-p",
    "tsconfig.json",
    "--noEmit",
    "false",
    "--declaration",
    "--emitDeclarationOnly",
    "--outDir",
    "dist",
]);

const exitCode = await tsc.exited;
if (exitCode !== 0) {
    console.error("\n❌ Type generation failed\n");
    process.exit(exitCode);
}

console.log("✅ Build complete!");
