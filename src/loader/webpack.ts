import * as webpack from "webpack";

function markModuleAsCompiledToWasm(compilation: webpack.Compilation, module: webpack.Module) {
  module.buildMeta.asLoaderCompiledToWasm = true;
}

function isModuleCompiledToWasm(compilation: webpack.Compilation, module: webpack.Module): boolean {
  const issuerModule = compilation.moduleGraph.getIssuer(module);

  return Boolean(
    module.buildMeta.asLoaderCompiledToWasm ||
      (issuerModule && isModuleCompiledToWasm(compilation, issuerModule))
  );
}

export { markModuleAsCompiledToWasm, isModuleCompiledToWasm };
