// pnpm workspaceへの分割（#66）を再実行できるようにする移行スクリプト。
// 他ブランチのrebase後に `node scripts/workspace-split.mjs --move --rewrite` を流すと、
// 移動表どおりにgit mvし、`@/`と相対パスのimportを新しい場所（別パッケージならsubpath export）へ書き換える。
//
//   --move            移動表のファイルを git mv する（移動済みは飛ばす）
//   --rewrite [dir…]  src/ db/ packages/（または指定ディレクトリ）のimportを書き換える
//   --layer <name>    指定した層までの移動表だけを使う（api-contract | domain | ui）
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");

// 層ごとの移動表。[移動元, 移動先]。ディレクトリは配下ごと移す。
const LAYERS = [
  {
    name: "api-contract",
    moves: [
      ["src/api/generated/models", "packages/api-contract/src/models"],
      ["src/api/generated/zod", "packages/api-contract/src/zod"],
    ],
  },
  {
    name: "domain",
    moves: [
      // validation.tsはcalendar-dateに依存し、task-editorから使われるためdomainに置く（循環の解消）。
      ["src/api/validation.ts", "packages/domain/src/validation.ts"],
      ["src/domain", "packages/domain/src"],
    ],
  },
];

const args = process.argv.slice(2);
const layerIndex = args.includes("--layer")
  ? LAYERS.findIndex((layer) => layer.name === args[args.indexOf("--layer") + 1])
  : LAYERS.length - 1;
if (layerIndex < 0)
  throw new Error(`Unknown layer. Use one of: ${LAYERS.map((l) => l.name).join(", ")}`);
const moves = LAYERS.slice(0, layerIndex + 1).flatMap((layer) => layer.moves);

const toPosix = (path) => path.split(sep).join("/");
const abs = (path) => join(root, path);
const isDir = (path) => existsSync(abs(path)) && statSync(abs(path)).isDirectory();
const isFile = (path) => existsSync(abs(path)) && statSync(abs(path)).isFile();
const walk = (dir) =>
  readdirSync(abs(dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (name === "node_modules" || name === "routeTree.gen.ts") return [];
    return isDir(path) ? walk(path) : [path];
  });

// ファイル単位の対応表（移動元→移動先）。移動前後のどちらでも作れる。
// ファイル指定の行を先に登録し、ディレクトリ指定の行はそれ以外のファイルだけを受け持つ。
const fileMoves = new Map();
const isDirMove = ([from, to]) => isDir(from) || (!isFile(from) && isDir(to));
for (const [from, to] of moves.filter((move) => !isDirMove(move))) fileMoves.set(from, to);
const claimed = new Set(fileMoves.values());
for (const [from, to] of moves.filter(isDirMove)) {
  if (isDir(from))
    for (const file of walk(from))
      if (!fileMoves.has(file)) fileMoves.set(file, to + file.slice(from.length));
  if (isDir(to))
    for (const file of walk(to))
      if (!claimed.has(file) && !fileMoves.has(from + file.slice(to.length)))
        fileMoves.set(from + file.slice(to.length), file);
}
const originOf = new Map([...fileMoves].map(([from, to]) => [to, from]));

if (args.includes("--move")) {
  // ファイル単位でgit mvし、移動先のディレクトリが既にあっても（rebase後の追加ファイルなど）合流できるようにする。
  for (const [from, to] of fileMoves) {
    if (!isFile(from)) continue;
    if (existsSync(abs(to))) throw new Error(`Both ${from} and ${to} exist`);
    mkdirSync(dirname(abs(to)), { recursive: true });
    execFileSync("git", ["mv", from, to], { cwd: root, stdio: "inherit" });
  }
}

// packages/<name>/package.json のexportsから、ファイル→subpath specifierを引く。
const packages = isDir("packages")
  ? readdirSync(abs("packages"))
      .filter((name) => isFile(`packages/${name}/package.json`))
      .map((name) => {
        const json = JSON.parse(readFileSync(abs(`packages/${name}/package.json`), "utf8"));
        return { dir: `packages/${name}`, name: json.name, exports: json.exports ?? {} };
      })
  : [];
const packageOf = (file) => packages.find((pkg) => file.startsWith(`${pkg.dir}/`));
const exportSpecifier = (pkg, file) => {
  const target = `./${file.slice(pkg.dir.length + 1)}`;
  const entries = Object.entries(pkg.exports);
  const exact = entries.find(([, value]) => value === target);
  if (exact) return pkg.name + exact[0].slice(1);
  for (const [key, value] of entries) {
    if (!value.includes("*")) continue;
    const [prefix, suffix] = value.split("*");
    if (target.startsWith(prefix) && target.endsWith(suffix) && target.length >= value.length - 1) {
      const middle = target.slice(prefix.length, target.length - suffix.length);
      return pkg.name + key.slice(1).replace("*", middle);
    }
  }
  throw new Error(`${file} is not exported from ${pkg.name}`);
};

const EXTENSIONS = ["", ".ts", ".tsx", ".d.ts", "/index.ts", "/index.tsx"];
const resolveIn = (base, exists) => {
  for (const ext of EXTENSIONS) {
    const candidate = toPosix(base + ext);
    if (exists(candidate)) return candidate;
  }
  return null;
};
const existsNow = (path) => isFile(path);
// 移動前の配置での存在判定（移動済みのファイルは対応表のキーとして存在する扱い）。
const existedBefore = (path) => fileMoves.has(path) || (isFile(path) && !originOf.has(path));

const rewriteSpecifier = (importer, specifier) => {
  const [path, query = ""] = specifier.split(/(?=\?)/);
  const origin = originOf.get(importer) ?? importer;
  let target = null;
  if (path.startsWith("@/")) {
    target = resolveIn(`src/${path.slice(2)}`, existedBefore);
    if (target) target = fileMoves.get(target) ?? target;
  } else {
    // 書き換え済み（新しい配置で解決できる）なら優先し、だめなら移動前の配置で解決する。
    target = resolveIn(toPosix(relative(root, resolve(abs(dirname(importer)), path))), existsNow);
    if (!target) {
      target = resolveIn(
        toPosix(relative(root, resolve(abs(dirname(origin)), path))),
        existedBefore,
      );
      if (target) target = fileMoves.get(target) ?? target;
    }
  }
  if (!target) return specifier;

  const importerPkg = packageOf(importer);
  const targetPkg = packageOf(target);
  if (targetPkg && targetPkg !== importerPkg) return exportSpecifier(targetPkg, target) + query;
  if (!targetPkg && importerPkg) {
    throw new Error(`${importer} imports app file ${target}; move it into a package first`);
  }
  const strip = (file) => {
    const noExt = file.replace(/(\.d)?\.tsx?$/, "");
    return /(^|\/)index$/.test(path) ? noExt : noExt.replace(/\/index$/, "");
  };
  // アプリ内は元の書き方（@/ か相対）を保ち、パッケージ内は相対パスにする。
  if (path.startsWith("@/") && !importerPkg) return `@/${strip(target).slice(4)}${query}`;
  let rel = toPosix(relative(dirname(importer), strip(target)));
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel + query;
};

const SPECIFIER = /(\bfrom\s*|\bimport\s*\(?\s*|\bmock\(\s*)(["'])(@\/[^"']*|\.{1,2}\/[^"']*)\2/g;

if (args.includes("--rewrite")) {
  const dirs = args.filter((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--layer");
  const files = (dirs.length ? dirs : ["src", "db", "packages"])
    .filter(isDir)
    .flatMap(walk)
    .filter((file) => /\.(m?js|tsx?)$/.test(file));
  const rewritten = [];
  for (const file of files) {
    const source = readFileSync(abs(file), "utf8");
    const next = source.replace(
      SPECIFIER,
      (_, lead, quote, specifier) => `${lead}${quote}${rewriteSpecifier(file, specifier)}${quote}`,
    );
    if (next !== source) {
      writeFileSync(abs(file), next);
      rewritten.push(file);
      console.log(`rewrote ${file}`);
    }
  }
  // specifierの長さが変わるとimportの折り返しが変わるため整形し直す。
  if (rewritten.length) execFileSync("vp", ["fmt", ...rewritten], { cwd: root, stdio: "inherit" });
}
