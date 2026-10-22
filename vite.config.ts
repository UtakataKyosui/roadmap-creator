import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import path from "path";
import { defineConfig, lazyPlugins } from "vite-plus";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { voidPlugin } from "void";

// packagesからアプリ（@/ = src/）は参照できない。
const appImports = {
  group: ["@/**"],
  message: "packagesからアプリのファイルは参照しない。必要なものはパッケージへ移す。",
};

export default defineConfig({
  // pnpm workspaceのルートがアプリ本体のため、vp dev/build/previewの対象をルートに固定する。
  defaultPackage: ".",
  staged: {
    "*": "vp check --fix",
  },
  fmt: { ignorePatterns: [".agents/**"] },
  lint: {
    ignorePatterns: ["src/api/generated/**", "packages/api-contract/src/**"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    // パッケージの依存は api-contract ← domain ← ui ← アプリ の一方向に保つ。
    overrides: [
      {
        files: ["packages/**"],
        rules: { "no-restricted-imports": ["error", { patterns: [appImports] }] },
      },
      {
        files: ["packages/domain/**"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              patterns: [
                appImports,
                {
                  regex: "^(react|react-dom|@roadmapper/ui)(/.*)?$",
                  message: "domainは画面に依存しない純粋なロジックに限る。",
                },
              ],
            },
          ],
        },
      },
      {
        files: ["packages/ui/**"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              patterns: [
                appImports,
                {
                  group: ["@tanstack/**", "void", "void/**"],
                  message:
                    "uiは表示だけを担い、ルーティング・データ取得・サーバー機能はアプリに置く。",
                },
              ],
            },
          ],
        },
      },
    ],
    options: { typeAware: true, typeCheck: true },
  },
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: lazyPlugins(() => [
    voidPlugin(),
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
    }),
    viteReact(),
  ]),
});
