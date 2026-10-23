import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // users.csv / tickets.csv are read with fs at runtime; make sure they ship
  // inside every serverless function bundle on Vercel.
  outputFileTracingIncludes: {
    "/**": ["./data/*.csv"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
