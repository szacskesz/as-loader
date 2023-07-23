import * as path from "path";
import type { LoaderDefinitionFunction } from "webpack";
// @ts-expect-error //No proper typings for module
import { interpolateName } from "loader-utils";
// @ts-ignore //Importing ESM modules needs dynamic import, but for type only imports it is safe to suppress the error
import type { CompilerOptions as AscCompilerOptions } from "assemblyscript/dist/asc.d.ts";
import { AscError } from "./asc-error.js";
import { createAscCompilerHost } from "./asc-compiler-host.js";
import { mapAscOptionsToArgs } from "./asc-options.js";
import * as cliColor from "cli-color";


const loader: LoaderDefinitionFunction<AscCompilerOptions & { optimizeFor?: "speed" | "size" | "both" }> = function(this, content) {
    const callback = this.async();

    (async () => {
        const asc = await import("assemblyscript/dist/asc.js").then(m => m.default)
        const { DiagnosticCategory } = await import("assemblyscript/dist/assemblyscript.js")

        const loaderOptions = this.getOptions();
        const optimizeFor: "speed" | "size" | "both" = loaderOptions.optimizeFor ?? "both";
        delete loaderOptions.optimizeFor;
    
        const baseDir = ".";
        const baseOutputFileName: string = interpolateName(this, "[name].[contenthash]", { context: this.rootContext, content: content });
        const outputFileName: string = baseOutputFileName + ".wasm";
        const outputBindingsFileName: string = baseOutputFileName + ".js";
        const outputSourceMapFileName = baseOutputFileName + ".wasm.map";
    
        const ascCompile = async () => {
            const ascCompilerHost = await createAscCompilerHost(this);
            const ascCompileResult = await asc.main(
                [
                    this.resourcePath,
                    ...mapAscOptionsToArgs({
                        ...loaderOptions,
                        baseDir: baseDir,
                        outFile: outputFileName,
                        bindings: ["raw"],
                        debug: this.mode !== "production",
                        optimizeLevel: this.mode === "production" && optimizeFor !== "size" ? 3 : 0,
                        shrinkLevel: this.mode === "production" && optimizeFor !== "speed" ? 2 : 0,
                        converge: this.mode === "production",
                        noAssert: this.mode === "production",
                        sourceMap: this.sourceMap === true,
                    }),
                ],
                ascCompilerHost,
            );
    
            return { ascCompileResult, ascCompilerHost };
        }
    
        ascCompile().then(async ({ ascCompileResult, ascCompilerHost }) => {
            const ascHandleCompileMessages = async () => {
                const stdError = ascCompilerHost.getStderrString();
                const resetColorToken = "\x1b[0m";
                const formattedBlocks = stdError
                    .replace(/\r/g, "")
                    .split("\n\n")
                    .map(block => block
                        .split("\n")
                        .map(line => `${resetColorToken}${line}${resetColorToken}`)
                        .join("\n")
                    );
                const formattedErrors = formattedBlocks.filter(l => cliColor.strip(l).startsWith("ERROR"));
                const formattedWarnings = formattedBlocks.filter(l => cliColor.strip(l).startsWith("WARNING"));

                if(formattedErrors.length > 0) {
                    this.emitError(new Error(formattedErrors.join("\n\n")));
                }

                if(formattedWarnings.length > 0) {
                    this.emitWarning(new Error(formattedWarnings.join("\n\n")));
                }
    
                const diagnosticErrorCount = Math.max(
                    formattedErrors.length,
                    ascCompilerHost.getDiagnostics().filter((diagnostic) => diagnostic.category === DiagnosticCategory.Error).length
                );
                if (diagnosticErrorCount > 0) {
                    throw new AscError(`Compilation failed - found ${diagnosticErrorCount} error(s).`);
                } else if (ascCompileResult?.error) {
                    throw ascCompileResult?.error;
                }
            }
    
            const ascHandleOutputFile = async () => {
                const outFileContent = await ascCompilerHost.readFile(outputFileName, baseDir);
                if (outFileContent == null) throw new AscError("Error on compiling AssemblyScript: No wasm emitted!");
    
                this.emitFile(outputFileName, outFileContent, undefined, {
                    minimized: true,
                    immutable: true,
                    sourceFilename: path
                        .relative(this.rootContext, this.resourcePath)
                        .replace(/\\/g, "/"),
                });
            }
    
            const ascHandleOutputSourceMapFile = async () => {
                const sourceMapFileContent = this.sourceMap
                    ? await ascCompilerHost.readFile(outputSourceMapFileName, baseDir)
                    : undefined;
    
                if (sourceMapFileContent) {
                    this.emitFile(outputSourceMapFileName, sourceMapFileContent, undefined, {
                        // we can't easily re-write link from wasm to source map and because of that,
                        // we can't use [contenthash] for source map file name
                        immutable: false,
                        development: true,
                    });
                }
            }
    
            const ascHandleOutputBindingsFile = async () => {
                const bindingsFileContent = await ascCompilerHost.readFile(outputBindingsFileName, baseDir);
                if (bindingsFileContent == null) throw new AscError("Error on compiling AssemblyScript: No raw bindings emitted!");

                return callback(
                    null, 
                    `export const url = __webpack_public_path__ + ${JSON.stringify(baseOutputFileName)};\n`
                    + bindingsFileContent
                );
            }
    
            try {
                await ascHandleCompileMessages();
                await ascHandleOutputFile();
                await ascHandleOutputSourceMapFile();
                await ascHandleOutputBindingsFile();
            } catch (e: any) {
                callback(e);
            }
        });
    })();
}

export default loader;
