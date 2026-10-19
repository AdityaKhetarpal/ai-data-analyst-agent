import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sql.js loads its WebAssembly file at run time, so keep it as a normal Node package and ship the files with the API
  serverExternalPackages: ["sql.js"],
  outputFileTracingIncludes: {
    "/api/ask": ["./public/data/shop.db", "./node_modules/sql.js/dist/sql-wasm.wasm"],
  },
};

export default nextConfig;
