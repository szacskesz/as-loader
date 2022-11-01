import type { AsLoaderRuntime } from "./runtime";
import type { PointerCastObject } from "./pointer";
import type { BoundExports } from "./bound";

export interface AsLoaderModule<TModule> extends String {
  fallback?(): Promise<TModule>;
}

export interface WasmModuleInstance<TModule extends Record<any, any>> {
  type: "wasm";
  exports: AsLoaderRuntime & PointerCastObject<TModule>;
  module: WebAssembly.Module;
  instance: WebAssembly.Instance;
}
export interface BoundWasmModuleInstance<TModule extends Record<any, any>, TImports> {
  type: "wasm-bound";
  exports: AsLoaderRuntime & BoundExports<TModule>;
  unboundExports: AsLoaderRuntime & PointerCastObject<TModule>;
  importObject: TImports;
  module: WebAssembly.Module;
  instance: WebAssembly.Instance;
}
export interface JsModuleInstance<TModule> {
  type: "js";
  exports: TModule;
}
export type ModuleInstance<TModule extends Record<any, any>> =
  | WasmModuleInstance<TModule>
  | JsModuleInstance<TModule>;
export type BoundModuleInstance<TModule extends Record<any, any>, TImport> =
  | BoundWasmModuleInstance<TModule, TImport>
  | JsModuleInstance<TModule>;
