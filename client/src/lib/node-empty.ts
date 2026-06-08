// Empty stub for Node built-ins (fs, path, crypto) referenced by the Emscripten
// glue of qpdf-wasm. Those requires sit behind an `ENVIRONMENT_IS_NODE` guard and
// never run in the browser, but Vite's CommonJS resolver still tries to resolve
// them at build time. Aliasing them here keeps the browser bundle building.
export default {};
