import { defineConfig } from "orval";

const input = "./openapi/openapi.yaml";

export default defineConfig({
  api: {
    input,
    output: {
      mode: "tags-split",
      target: "./src/api/generated/endpoints",
      schemas: "./src/api/generated/models",
      client: "react-query",
      httpClient: "fetch",
      baseUrl: "/api",
      clean: true,
      override: {
        mutator: { path: "./src/api/http.ts", name: "customFetch" },
        fetch: { forceSuccessResponse: true },
      },
    },
    hooks: {
      afterAllFilesWrite: "vp fmt src/api/generated",
    },
  },
  zod: {
    input,
    output: {
      mode: "tags-split",
      target: "./src/api/generated/zod",
      client: "zod",
      fileExtension: ".zod.ts",
      clean: true,
    },
    hooks: {
      afterAllFilesWrite: "vp fmt src/api/generated",
    },
  },
});
