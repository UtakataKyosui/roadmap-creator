import { execFileSync } from "node:child_process";

// 検証でindexを変更しない。追跡済みの差分と新規生成ファイルの両方を検出する。
execFileSync("git", ["diff", "--exit-code", "HEAD", "--", "src/api/generated"], {
  stdio: "inherit",
});
const untracked = execFileSync(
  "git",
  ["ls-files", "--others", "--exclude-standard", "--", "src/api/generated"],
  { encoding: "utf8" },
);
if (untracked.trim()) throw new Error(`Commit newly generated API files:\n${untracked}`);
