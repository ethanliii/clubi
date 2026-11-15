// Lets the Data tests import the real files under convex/, which use extensionless imports and
// import types without `import type`:
//   const { lumaToRow } = await load("imports/luma");
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:") && !/\.(ts|js|mjs|json)$/.test(specifier)) {
      const base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
      for (const candidate of [base + ".ts", base + ".js", base + "/index.ts"]) {
        if (existsSync(candidate)) return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".ts") && !url.includes("/node_modules/")) {
      const file = fileURLToPath(url);
      const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        fileName: file,
      });
      return { format: "module", source: outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

export const load = (module) => import(new URL(`../../convex/${module}.ts`, import.meta.url).href);

export const fixture = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
export const jsonFixture = (name) => JSON.parse(fixture(name));
