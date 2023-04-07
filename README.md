<div align="center">
  <img width="100" height="100" src="public/media/assemblyscript-logo.svg" alt="AssemblyScript logo">
  <img width="100" height="100" src="public/media/webpack-logo.svg" alt="webpack logo">

  <h1>as-loader</h1>
  <p>AssemblyScript loader for webpack</p>

  [![npm version](https://img.shields.io/npm/v/as-loader.svg)](https://www.npmjs.com/package/@szacskesz/as-loader)
</div>

## Installation

This loader requires [AssemblyScript >= 0.27.1](https://github.com/AssemblyScript/assemblyscript), 
Node.js >= 12 and [webpack 5](https://github.com/webpack/webpack)

```sh
# Install as an alias
npm install as-loader@npm:@szacskesz/as-loader
npm install --save-dev assemblyscript
```

The minimal `webpack.config.js`:

```js
module.exports = {
  entry: "src/index.ts",
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        // Can use any pattern if it ends with ".ts" or ".tsx"
        test: /\.asc\.ts?$/,
        loader: "as-loader",
        options: {
          // Other assemblyscript compiler options...
        },
      },
      // If you use typescript files too
      {
        test: /\.ts$/,
        exclude: [/\.asc\.ts?$/],
        loader: "ts-loader",
      },
    ],
  },
};
```

## Usage

By default, the loader emits a `.wasm` file (+ `.wasm.map` if source maps are enabled) and creates a CommonJS module that exports the URL to the emitted `.wasm` file and the raw bindings's `instantiate` function.

To simplify loading logic, you can use the `instantiateModule` function from `as-loader/dist/runtime`.

```typescript
import * as assemblyModule from "./assembly/add.asc";
import { instantiateModule } from "as-loader/dist/runtime";


instantiateModule(assemblyModule).then(({ add, addMyObjs }) => {
  console.warn("add(1, 7) = " + add(1, 7));
});
```

### Example repository

https://stackblitz.com/edit/webpack-webpack-js-org-waje4g

https://github.com/szacskesz/webpack-assemblyscript-loader-example

### Example repository with angular

https://github.com/szacskesz/angular-assemblyscript-loader-example

## License

MIT
