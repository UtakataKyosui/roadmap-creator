import { defineConfig } from "vite-plus";

// アプリ用のvite.config.tsはvoidとTanStack Startのプラグインを読み込むため、テストでは使わない。
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    // forksのコード転送用一時ファイルで起きるENOENTを避け、スレッド間で直接渡す。
    pool: "threads",
    include: ["src/**/*.test.ts", "packages/*/src/**/*.test.ts"],
  },
});
