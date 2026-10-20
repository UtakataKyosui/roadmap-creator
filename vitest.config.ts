import { defineConfig } from "vite-plus";

// アプリ用のvite.config.tsはvoidとTanStack Startのプラグインを読み込むため、テストでは使わない。
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
