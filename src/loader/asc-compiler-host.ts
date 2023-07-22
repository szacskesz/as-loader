import * as path from "path";
// @ts-ignore //Importing ESM modules needs dynamic import, but for type only imports it is safe to suppress the error
import type { DiagnosticMessage, APIOptions } from "assemblyscript/dist/asc.js";


export type AscCompilerHost = Required<
    Pick<
        APIOptions,
        | "stdout"
        | "stderr"
        | "readFile"
        | "writeFile"
        | "listFiles"
        | "reportDiagnostic"
    >
> & {
    getDiagnostics(): DiagnosticMessage[];
    getStderrString(): string;
    getStdoutString(): string;
};

export async function createAscCompilerHost(context: any): Promise<AscCompilerHost> {
    const asc = await import("assemblyscript/dist/asc.js").then(m => m.default)

    const memVolume: Record<string, Buffer> = {};
    const stderr = asc.createMemoryStream();
    const stdout = asc.createMemoryStream();
    // HACK: make assemblyscrip think it is a real console to format strings
    (stderr as any).isTTY = true;
    (stdout as any).isTTY = true;
    const diagnostics: DiagnosticMessage[] = [];

    function readFile(fileName: string, baseDir: string) {
        const filePath = baseDir ? path.resolve(baseDir, fileName) : fileName;

        if (memVolume[filePath]) {
            return memVolume[filePath];
        }

        try {
            const content = context.fs.readFileSync(filePath, "utf8");
            context.addDependency(filePath);

            return typeof content === "string" ? content : content.toString("utf8");
        } catch (error) {
            return null;
        }
    }

    function writeFile(fileName: string, contents: Uint8Array, baseDir: string) {
        const filePath = baseDir ? path.resolve(baseDir, fileName) : fileName;

        memVolume[filePath] = Buffer.isBuffer(contents)
            ? contents
            : Buffer.from(contents);
    }

    function listFiles(dirName: string, baseDir: string) {
        const dirPath = baseDir ? path.resolve(baseDir, dirName) : dirName;

        try {
            return context.fs
                .readdirSync(dirPath)
                .filter(
                    (file: string) => file.endsWith(".ts") && !file.endsWith(".d.ts")
                );
        } catch (error) {
            return null;
        }
    }

    function reportDiagnostic(diagnostic: DiagnosticMessage) {
        diagnostics.push(diagnostic);
    }

    function getDiagnostics(): DiagnosticMessage[] {
        return diagnostics;
    }

    function getStderrString(): string {
        return stderr.toString();
    }

    function getStdoutString(): string {
        return stdout.toString();
    }

    return {
        readFile,
        writeFile,
        listFiles,
        reportDiagnostic,
        getDiagnostics,
        getStderrString,
        getStdoutString,
        stderr,
        stdout,
    };
}
