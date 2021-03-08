import path from "path";
import {
  createSandbox,
  Sandbox,
  packLocalPackage,
  createProcessDriver,
} from "karton";
import { instantiate } from "@assemblyscript/loader/umd";

jest.setTimeout(60000);

const WEBPACK_4 = "4.46.0";
const WEBPACK_5 = "5.24.2";

describe("as-loader", () => {
  let sandbox: Sandbox;

  beforeAll(async () => {
    sandbox = await createSandbox({
      lockDirectory: path.resolve(__dirname, "__locks__"),
      fixedDependencies: {
        "as-loader": `file:${await packLocalPackage(
          path.resolve(__dirname, "../../")
        )}`,
      },
    });
  });
  afterEach(async () => {
    await sandbox.reset();
  });
  afterAll(async () => {
    await sandbox.cleanup();
  });

  describe("single compilation", () => {
    it.each([[{ webpack: WEBPACK_4 }], [{ webpack: WEBPACK_5 }]])(
      "works without options with %p",
      async (dependencies) => {
        await sandbox.load(path.resolve(__dirname, "fixtures/main"));
        await sandbox.install("yarn", dependencies);

        const results = await sandbox.exec("yarn webpack");

        expect(results).toContain("simple.wasm");
        expect(results).toContain("simple.wasm.map");
        expect(results).toContain("main.js");

        const simpleWasmInstance = await instantiate<
          typeof import("./fixtures/main/src/assembly/correct/simple")
        >(await sandbox.read("dist/simple.wasm"));

        expect(simpleWasmInstance.exports.run()).toEqual(15);

        const simpleWasmMap = await sandbox.read(
          "dist/simple.wasm.map",
          "utf8"
        );
        expect(Object.keys(JSON.parse(simpleWasmMap))).toEqual(
          expect.arrayContaining(["version", "sources", "names", "mappings"])
        );
      }
    );

    it.each([[{ webpack: WEBPACK_4 }], [{ webpack: WEBPACK_5 }]])(
      "reports errors in project with %p",
      async (dependencies) => {
        await sandbox.load(path.resolve(__dirname, "fixtures/main"));
        await sandbox.install("yarn", dependencies);

        await sandbox.patch(
          "webpack.config.js",
          'entry: "./src/correct.ts",',
          'entry: "./src/broken.ts",'
        );

        const results = await sandbox.exec("yarn webpack", { fail: true });

        expect(results).toContain(
          [
            "ERROR in ./src/assembly/broken/simple.ts",
            "Module build failed (from ./node_modules/as-loader/lib/index.js):",
            "AssemblyScriptError: Compilation failed - found 3 errors.",
          ].join("\n")
        );
        expect(results).toContain(
          [
            "ERROR in ./src/assembly/broken/simple.ts 4:14-15",
            "Type 'i32' is not assignable to type '~lib/string/String'.",
          ].join("\n")
        );
        expect(results).toContain(
          [
            "ERROR in ./src/assembly/broken/shared.ts 2:14-15",
            "Type 'i32' is not assignable to type '~lib/string/String'.",
          ].join("\n")
        );
        expect(results).toContain(
          [
            "ERROR in ./src/assembly/broken/shared.ts 2:10-15",
            "Type '~lib/string/String' is not assignable to type 'i32'.",
          ].join("\n")
        );
      }
    );

    it.each([
      ["webassembly/sync", "syncWebAssembly"],
      ["webassembly/async", "asyncWebAssembly"],
    ])("loads using %s type", async (type, experiment) => {
      await sandbox.load(path.resolve(__dirname, "fixtures/main"));
      await sandbox.install("yarn", { webpack: WEBPACK_5 });

      await sandbox.patch(
        "webpack.config.js",
        'entry: "./src/correct.ts",',
        'entry: "./src/async.ts",'
      );
      await sandbox.patch(
        "webpack.config.js",
        '        loader: "as-loader",',
        ['        loader: "as-loader",', `        type: "${type}",`].join("\n")
      );
      await sandbox.patch(
        "webpack.config.js",
        '  mode: "development",',
        [
          '  mode: "development",',
          "  experiments: {",
          `    ${experiment}: true,`,
          "  },",
        ].join("\n")
      );

      const results = await sandbox.exec("yarn webpack");

      expect(results).toContain("main.js");
      expect(results).toContain(".wasm");

      const distDirents = await sandbox.list("dist");
      const simpleWasmDirent = distDirents.find(
        (dirent) => dirent.isFile() && dirent.name.endsWith(".wasm")
      );
      expect(simpleWasmDirent).toBeDefined();

      const simpleWasmInstance = await instantiate<
        typeof import("./fixtures/main/src/assembly/correct/simple")
      >(await sandbox.read(`dist/${simpleWasmDirent?.name}`));

      expect(simpleWasmInstance.exports.run()).toEqual(15);
    });
  });

  describe("watch compilation", () => {
    it.each([[{ webpack: WEBPACK_4 }], [{ webpack: WEBPACK_5 }]])(
      "re-compiles wasm file on change with %p",
      async (dependencies) => {
        await sandbox.load(path.resolve(__dirname, "fixtures/main"));
        await sandbox.install("yarn", dependencies);

        const webpack = createProcessDriver(
          await sandbox.spawn("yarn webpack --watch")
        );

        await webpack.waitForStdoutIncludes([
          "simple.wasm ",
          "simple.wasm.map ",
        ]);

        expect(await sandbox.exists("dist/simple.wasm")).toBe(true);
        expect(await sandbox.exists("dist/simple.wasm.map")).toBe(true);

        // update assembly script file
        await sandbox.patch("src/assembly/correct/shared.ts", "a + b", "a - b");

        await webpack.waitForStdoutIncludes([
          "simple.wasm ",
          "simple.wasm.map ",
        ]);

        const simpleWasmInstance = await instantiate<
          typeof import("./fixtures/main/src/assembly/correct/simple")
        >(await sandbox.read(`dist/simple.wasm`));

        expect(simpleWasmInstance.exports.run()).toEqual(-5);
      }
    );

    it.each([[{ webpack: WEBPACK_4 }], [{ webpack: WEBPACK_5 }]])(
      "reports errors on change with %p",
      async (dependencies) => {
        await sandbox.load(path.resolve(__dirname, "fixtures/main"));
        await sandbox.install("yarn", dependencies);

        const webpack = createProcessDriver(
          await sandbox.spawn("yarn webpack --watch")
        );

        await webpack.waitForStdoutIncludes("simple.wasm ");

        // update assembly script file
        await sandbox.patch(
          "src/assembly/correct/shared.ts",
          "a: i32",
          "a: string"
        );

        await webpack.waitForStdoutIncludes([
          "AssemblyScriptError: Compilation failed - found 3 errors.",
          [
            "ERROR in ./src/assembly/correct/simple.ts 4:14-15",
            "Type 'i32' is not assignable to type '~lib/string/String'.",
          ].join("\n"),
          [
            "ERROR in ./src/assembly/correct/shared.ts 2:14-15",
            "Type 'i32' is not assignable to type '~lib/string/String'.",
          ].join("\n"),
          [
            "ERROR in ./src/assembly/correct/shared.ts 2:10-15",
            "Type '~lib/string/String' is not assignable to type 'i32'.",
          ].join("\n"),
        ]);

        await sandbox.patch("src/assembly/correct/shared.ts", "a + b", "a - b");

        await webpack.waitForStdoutIncludes(
          "AssemblyScriptError: Compilation failed - found 2 errors."
        );

        await sandbox.patch(
          "src/assembly/correct/shared.ts",
          "a: string",
          "a: i32"
        );

        await webpack.waitForStdoutIncludes("simple.wasm ");

        const simpleWasm = await sandbox.read(`dist/simple.wasm`);
        const simpleWasmInstance = await instantiate<
          typeof import("./fixtures/main/src/assembly/correct/simple")
        >(simpleWasm);

        expect(simpleWasmInstance.exports.run()).toEqual(-5);
      }
    );
  });

  describe("options", () => {
    it("passes options to assemblyscript compiler", async () => {
      await sandbox.load(path.resolve(__dirname, "fixtures/main"));
      await sandbox.install("yarn", { webpack: WEBPACK_5 });

      await sandbox.patch(
        "webpack.config.js",
        '          name: "[name].wasm",',
        [
          '          name: "[name].wasm",',
          "          optimizeLevel: 2,",
          "          shrinkLevel: 1,",
          "          coverage: true,",
          "          noAssert: true,",
          '          runtime: "stub",',
          "          debug: true,",
          '          trapMode: "allow",',
          "          noValidate: true,",
          "          importMemory: false,",
          "          noExportMemory: true,",
          "          initialMemory: 1000,",
          "          maximumMemory: 2000,",
          "          sharedMemory: true,",
          "          importTable: false,",
          "          exportTable: false,",
          "          explicitStart: false,",
          '          enable: ["simd", "threads"],',
          '          disable: ["mutable-globals"],',
          "          lowMemoryLimit: false,",
          "          memoryBase: 1024,",
          "          tableBase: 0,",
        ].join("\n")
      );

      const results = await sandbox.exec("yarn webpack");
      expect(results).toContain("simple.wasm");
      expect(results).toContain("simple.wasm.map");
      expect(results).toContain("main.js");

      const simpleWasmInstance = await instantiate<
        typeof import("./fixtures/main/src/assembly/correct/simple")
      >(await sandbox.read("dist/simple.wasm"));

      expect(simpleWasmInstance.exports.run()).toEqual(15);

      const simpleWasmMap = await sandbox.read("dist/simple.wasm.map", "utf8");
      expect(Object.keys(JSON.parse(simpleWasmMap))).toEqual(
        expect.arrayContaining(["version", "sources", "names", "mappings"])
      );
    });
  });
});