import { execFileSync } from "node:child_process";

// endpointsはアプリ、型とZodは @roadmapper/api-contract に生成される。
const generated = ["src/api/generated", "packages/api-contract/src"];

// 検証でindexを変更しない。追跡済みの差分と新規生成ファイルの両方を検出する。
execFileSync("git", ["diff", "--exit-code", "HEAD", "--", ...generated], {
  stdio: "inherit",
});
const untracked = execFileSync(
  "git",
  ["ls-files", "--others", "--exclude-standard", "--", ...generated],
  { encoding: "utf8" },
);
if (untracked.trim()) throw new Error(`Commit newly generated API files:\n${untracked}`);
