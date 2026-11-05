// Lets service modules load outside Next.js for testing.
// PDF rendering is stubbed (it's exercised through the running app instead).
const Module = require("module");
const path = require("path");
const orig = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return path.join(__dirname, "empty.cjs");
  if (request === "@react-pdf/renderer") return path.join(__dirname, "pdf-stub.cjs");
  return orig.call(this, request, ...rest);
};
