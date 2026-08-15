// Module-loader hook: resolve the bare 'three' specifier to the vendored
// module so browser renderer modules load headless in Node tests (the
// import map does this job in the browser). Registered per test process
// (node --test isolates files), so nothing leaks across suites.
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const vendored = pathToFileURL(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', 'client', 'vendor', 'three.module.min.js')).href;

export function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: vendored, shortCircuit: true };
  return next(specifier, context);
}
