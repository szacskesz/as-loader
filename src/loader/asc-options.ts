// @ts-ignore //Importing ESM modules needs dynamic import, but for type only imports it is safe to suppress the error
import type { CompilerOptions as AscCompilerOptions } from "assemblyscript/dist/asc.d.ts";


export function mapAscOptionsToArgs(options: AscCompilerOptions): string[] {
    const args: string[] = [];
    const keys = Object.keys(options);

    for (const key of keys) {
        const value = options[key as keyof AscCompilerOptions];

        if (typeof value === "boolean") {
            // add flag only if value is true
            if (value) args.push("--" + key);
        } else if (typeof value === "string" || typeof value === "number") {
            args.push("--" + key, String(value));
        } else if (Array.isArray(value)) {
            args.push("--" + key, value.join(","));
        }
    }

    return args;
}
