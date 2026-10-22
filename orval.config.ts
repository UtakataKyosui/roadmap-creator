import { defineConfig } from "orval";

const input = "./openapi/openapi.yaml";

// 型とZodはサーバー・domainとも共有する契約として @roadmapper/api-contract に出力する。
// React Query用のendpointsはクライアント専用のためアプリに残す。
export default defineConfig({
  api: {
    input,
    output: {
      mode: "tags-split",
      target: "./src/api/generated/endpoints",
      schemas: {
        path: "./packages/api-contract/src/models",
        type: "typescript",
        importPath: "@roadmapper/api-contract/models",
      },
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
      afterAllFilesWrite: "vp fmt src/api/generated packages/api-contract/src",
    },
  },
  zod: {
    input,
    output: {
      mode: "tags-split",
      target: "./packages/api-contract/src/zod",
      client: "zod",
      fileExtension: ".zod.ts",
      clean: true,
    },
    hooks: {
      afterAllFilesWrite: "vp fmt packages/api-contract/src/zod",
    },
  },
});
