export async function instantiateModule<T>(
  _module: T,
  fetchFn: (url: string) => Promise<Response> = fetch,
  options: any = { env: {} },
): Promise<T> {
  const baseUrl = (_module as any).url as string;
  const wasmFileUrl = baseUrl + ".wasm";
  const instantiate = (_module as any).instantiate as (...args: any[]) => Promise<T>;

  const module = await WebAssembly.compileStreaming( fetchFn(wasmFileUrl) );
  return await (instantiate(module, options) as Promise<T>);
}
