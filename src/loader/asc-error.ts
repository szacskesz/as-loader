import * as path from "path";
// @ts-ignore //Importing ESM modules needs dynamic import, but for type only imports it is safe to suppress the error
import type { DiagnosticMessage } from "assemblyscript/dist/asc.js";
import type { AscCompilerHost } from "./asc-compiler-host.js";

interface Location {
    start?: LineColumn;
    end?: LineColumn;
}

interface ArtificialModule {
    identifier(): string;
    readableIdentifier(): string;
}

interface LineColumn {
    // 1-based line
    line: number;
    // 1-based column
    column: number;
}

export class AscError extends Error {
    readonly loc: Location | undefined;
    readonly module: ArtificialModule | undefined;

    constructor(message: string, file?: string, location?: Location) {
        super(message);
        Object.setPrototypeOf(this, AscError.prototype);

        this.name = "AscError";
        this.message = message;
        this.loc = location;

        // webpack quirks...
        this.module = {
            identifier() {
                return file || "";
            },
            readableIdentifier() {
                return file || "";
            },
        };

        Error.captureStackTrace(this, this.constructor);
    }

    private static getLineColumnFromIndex(
        source: string,
        index: number
    ): LineColumn | undefined {
        if (index < 0 || index >= source.length || isNaN(index)) {
            return undefined;
        }

        let line = 1;
        let prevLineIndex = -1;
        let nextLineIndex = source.indexOf("\n");

        while (nextLineIndex !== -1 && index > nextLineIndex) {
            prevLineIndex = nextLineIndex;
            nextLineIndex = source.indexOf("\n", prevLineIndex + 1);
            ++line;
        }
        const column = index - prevLineIndex;

        return {
            line,
            column,
        };
    }

    static async fromDiagnostic(
        diagnostic: DiagnosticMessage,
        ascCompilerHost: AscCompilerHost,
        baseDir: string,
        context: string
    ) {
        const fileName =
            diagnostic.range &&
            diagnostic.range.source &&
            diagnostic.range.source.normalizedPath;
        let location: Location | undefined;

        if (fileName) {
            const fileContent = await ascCompilerHost.readFile(fileName, baseDir);
            if (fileContent) {
                const start = diagnostic.range
                    ? this.getLineColumnFromIndex(fileContent, diagnostic.range.start)
                    : undefined;

                const end = diagnostic.range
                    ? this.getLineColumnFromIndex(fileContent, diagnostic.range.end)
                    : undefined;

                if (start || end) {
                    location = { start, end };
                }
            }
        }

        const baseUrl = path.relative(context, baseDir);
        const file = fileName
            ? `./${path.join(baseUrl, fileName).replace(/\\/g, "/")}`
            : undefined;

        return new AscError(diagnostic.message, file, location);
    }
}
