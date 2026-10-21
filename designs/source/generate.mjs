// Generates JSX strings for the Roadmap Studio phase 1 design (OpenPencil).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createMapDesign } from "./map-design.mjs";

const outputDirectory = process.argv[2];
if (!outputDirectory) throw new Error("Usage: node designs/source/generate.mjs <output-directory>");
mkdirSync(outputDirectory, { recursive: true });

const v = (name) => `{designVar('${name}')}`;
const F = 'font="Noto Sans JP"';
const T = (name, text, { size = 13, weight, color = "text-secondary", hex, extra = "" } = {}) =>
  `<Text name="${name}" size={${size}}${weight ? ` weight={${weight}}` : ""} ${F} color=${hex ? `"${hex}"` : v(color)} ${extra}>${text}</Text>`;
const I = (icon, size, hex) => `<Icon name="lucide:${icon}" size={${size}} color="${hex}" />`;
const GRAY = "#8C95A6",
  SEC = "#5A6476",
  IND = "#4F46E5",
  WHITE = "#FFFFFF";

export const STATUS = [
  {
    key: "todo",
    label: "未着手",
    accent: "text-tertiary",
    tint: "surface-subtle",
    text: "text-secondary",
    hex: GRAY,
    progress: 0,
  },
  {
    key: "in_progress",
    label: "進行中",
    accent: "indigo",
    tint: "indigo-tint",
    text: "indigo",
    hex: IND,
    progress: 76,
  },
  {
    key: "review",
    label: "レビュー",
    accent: "amber",
    tint: "amber-tint",
    text: "amber",
    hex: "#B45309",
    progress: 152,
  },
  {
    key: "done",
    label: "完了",
    accent: "teal",
    tint: "teal-tint",
    text: "teal",
    hex: "#0D9488",
    progress: -1,
  },
];
const PRIORITY = {
  低: ["surface-subtle", "text-tertiary"],
  中: ["surface-subtle", "text-secondary"],
  高: ["amber-tint", "amber"],
  緊急: ["danger-tint", "danger"],
};

// ---- Task card component set ----
const props = `properties={[
  { id: 'title', name: 'Title', type: 'TEXT', defaultValue: 'タスク名' },
  { id: 'priority', name: 'Priority', type: 'TEXT', defaultValue: '中' },
  { id: 'due', name: 'Due', type: 'TEXT', defaultValue: '10/28' },
  { id: 'comments', name: 'Comments', type: 'TEXT', defaultValue: '0' },
  { id: 'showLabel', name: 'Show label', type: 'BOOLEAN', defaultValue: 'false' },
  { id: 'assigned', name: 'Assigned', type: 'BOOLEAN', defaultValue: 'true' },
]}`;
const variant = (s) => `
<Component name="Status=${s.label}" w={252} h="hug" flex="col" bg=${v("surface")} rounded=${v("radius-md")} stroke=${v("border-strong")} strokeWidth={1} strokeAlign="inside" overflow="hidden" shadow="0 1 3 #15181E14">
  <Frame name="Card Body" w="fill" h="hug" flex="col" gap={8} pt={10} pr={10} pb={8} pl={10} stroke=${v(s.accent)} strokeWeights={{ top: 0, right: 0, bottom: 0, left: 3 }} strokeAlign="inside">
    <Frame name="Title Row" w="fill" flex="row" gap={6} items="start">
      ${I("grip-vertical", 14, GRAY)}
      ${T("Card Title", "タスク名", { weight: 600, color: "text-primary", extra: `w="fill" lineHeight={19} propertyRefs={[{ propertyId: 'title', field: 'TEXT' }]}` })}
    </Frame>
    <Frame name="Meta Row" w="fill" flex="row" gap={6} items="center">
      <Frame name="Priority Chip" flex="row" px={6} py={2} rounded={4} bg=${v("surface-subtle")}>
        ${T("Priority Label", "中", { size: 10.5, weight: 600, extra: `propertyRefs={[{ propertyId: 'priority', field: 'TEXT' }]}` })}
      </Frame>
      <Frame name="Label Chip" flex="row" gap={4} items="center" px={6} py={2} rounded={4} stroke=${v("border")} strokeWidth={1} propertyRefs={[{ propertyId: 'showLabel', field: 'VISIBLE' }]}>
        <Ellipse name="Label Dot" w={6} h={6} bg="#3B82F6" />
        ${T("Label Name", "基礎", { size: 10.5 })}
      </Frame>
      <Frame name="Meta Spacer" grow={1} h={1} />
      <Frame name="Comments" flex="row" gap={3} items="center">
        ${I("message-square", 12, GRAY)}
        ${T("Comment Count", "0", { size: 10.5, color: "text-tertiary", extra: `propertyRefs={[{ propertyId: 'comments', field: 'TEXT' }]}` })}
      </Frame>
      <Frame name="Due" flex="row" gap={3} items="center">
        ${I("calendar-days", 12, GRAY)}
        ${T("Due Text", "10/28", { size: 10.5, color: "text-tertiary", extra: `propertyRefs={[{ propertyId: 'due', field: 'TEXT' }]}` })}
      </Frame>
      <Frame name="Owner Avatar" w={22} h={22} rounded={11} bg=${v("indigo")} flex="row" justify="center" items="center" propertyRefs={[{ propertyId: 'assigned', field: 'VISIBLE' }]}>
        ${T("Owner Initial", "開", { size: 10, weight: 600, hex: WHITE })}
      </Frame>
    </Frame>
    <Frame name="Progress Track" w="fill" h={4} rounded={2} bg=${v("surface-subtle")} flex="row">
      ${s.progress === 0 ? "" : `<Rectangle name="Progress Fill" w=${s.progress < 0 ? '"fill"' : `{${s.progress}}`} h={4} rounded={2} bg=${v(s.accent)} />`}
    </Frame>
    <Frame name="Controls Row" w="fill" flex="row" gap={4} items="center" pt={6} stroke=${v("border")} strokeWeights={{ top: 1, right: 0, bottom: 0, left: 0 }} strokeAlign="inside">
      <Frame name="Status Select" flex="row" gap={4} items="center" pt={3} pb={3} pl={8} pr={6} rounded=${v("radius-sm")} stroke=${v("border")} strokeWidth={1}>
        ${T("Status Value", s.label, { size: 11 })}
        ${I("chevron-down", 12, GRAY)}
      </Frame>
      <Frame name="Controls Spacer" grow={1} h={1} />
      <Frame name="Move Up" w={24} h={24} rounded=${v("radius-sm")} flex="row" justify="center" items="center">${I("arrow-up", 14, SEC)}</Frame>
      <Frame name="Move Down" w={24} h={24} rounded=${v("radius-sm")} flex="row" justify="center" items="center">${I("arrow-down", 14, SEC)}</Frame>
    </Frame>
  </Frame>
</Component>`;
const components = `<ComponentSet name="Task Card" flex="row" gap={24} p={24} ${props}>${STATUS.map(variant).join("")}</ComponentSet>`;

// ---- Shared pieces ----
const btnPrimary = (label, icon = "plus", h = 36) =>
  `<Frame name="Primary Button" h={${h}} flex="row" gap={6} items="center" px={14} rounded=${v("radius-sm")} bg=${v("indigo")}>${icon ? I(icon, 14, WHITE) : ""}${T("Label", label, { weight: 600, hex: WHITE })}</Frame>`;
const btnOutline = (label, icon, h = 36) =>
  `<Frame name="Outline Button" h={${h}} flex="row" gap={6} items="center" px={14} rounded=${v("radius-sm")} bg=${v("surface")} stroke=${v("border-strong")} strokeWidth={1}>${icon ? I(icon, 14, "#15181E") : ""}${T("Label", label, { weight: 600, color: "text-primary" })}</Frame>`;

const nav = (label, icon, active) =>
  `<Frame name="Nav ${label}" w="fill" h={36} flex="row" gap={10} items="center" px={10} rounded=${v("radius-sm")}${active ? ` bg=${v("indigo-tint")}` : ""}>${I(icon, 16, active ? IND : SEC)}${T("Label", label, { weight: active ? 600 : undefined, color: active ? "indigo" : "text-secondary" })}</Frame>`;
const section = (label) =>
  `<Frame name="Section ${label}" w="fill" flex="row" pt={12} px={10} pb={4}>${T("Label", label, { size: 11, weight: 600, color: "text-tertiary" })}</Frame>`;

function shell({ name, crumbs, view, roadmap = true, heading, desc, actions = "", content }) {
  const crumbsJsx = crumbs
    .map(
      (c, i) =>
        (i ? I("chevron-right", 12, GRAY) : "") +
        T(`Crumb ${i}`, c, {
          size: 12,
          weight: i === crumbs.length - 1 ? 600 : undefined,
          color: i === crumbs.length - 1 ? "text-primary" : "text-tertiary",
        }),
    )
    .join("");
  const roadmaps = [
    ["はじめてのロードマップ", "indigo", roadmap],
    ["英語学習 2026", "teal", false],
    ["資格試験の準備", "amber", false],
  ]
    .map(
      ([n, c, a]) =>
        `<Frame name="Roadmap ${n}" w="fill" h={32} flex="row" gap={10} items="center" px={10} rounded=${v("radius-sm")}${a ? ` bg=${v("surface-subtle")}` : ""}><Ellipse name="Dot" w={7} h={7} bg=${v(c)} />${T("Name", n, { size: 12, weight: a ? 600 : undefined, color: a ? "text-primary" : "text-secondary" })}</Frame>`,
    )
    .join("");
  return `
<Frame name="${name}" w={1440} h={900} flex="col" bg=${v("bg-app")} overflow="hidden">
  <Frame name="Top Navigation" w="fill" h={56} flex="row" gap={12} items="center" px={20} bg=${v("surface")} stroke=${v("border")} strokeWeights={{ top: 0, right: 0, bottom: 1, left: 0 }} strokeAlign="inside">
    <Frame name="Logo Mark" w={28} h={28} rounded={8} bg=${v("indigo")} flex="row" justify="center" items="center">${I("map", 16, WHITE)}</Frame>
    ${T("Wordmark", "Roadmap Studio", { size: 15, weight: 600, color: "text-primary" })}
    <Rectangle name="Divider" w={1} h={20} bg=${v("border")} />
    <Frame name="Breadcrumb" flex="row" gap={6} items="center">${crumbsJsx}</Frame>
  </Frame>
  <Frame name="Body" w="fill" grow={1} flex="row">
    <Frame name="Sidebar" w={240} h="fill" flex="col" gap={4} py={16} px={12} bg=${v("surface")} stroke=${v("border")} strokeWeights={{ top: 0, right: 1, bottom: 0, left: 0 }} strokeAlign="inside">
      <Frame name="Workspace" w="fill" flex="row" gap={10} items="center" pt={4} px={4} pb={12}>
        <Frame name="Workspace Avatar" w={32} h={32} rounded={8} bg=${v("text-primary")} flex="row" justify="center" items="center">${T("Initial", "開", { weight: 600, hex: WHITE })}</Frame>
        <Frame name="Workspace Text" grow={1} flex="col" gap={2}>${T("Workspace Name", "開発用ワークスペース", { weight: 600, color: "text-primary" })}${T("Project Name", "学習プロジェクト", { size: 11, color: "text-tertiary" })}</Frame>
      </Frame>
      ${nav("ロードマップ一覧", "layout-list", view === "list")}
      ${roadmap ? section("はじめてのロードマップ") + nav("マップ", "git-branch", view === "map") + nav("ボード", "square-kanban", view === "board") + nav("タイムライン", "chart-gantt", view === "timeline") : ""}
      ${section("プロジェクトのロードマップ")}
      ${roadmaps}
    </Frame>
    <Frame name="Main" grow={1} h="fill" flex="col">
      <Frame name="Toolbar" w="fill" h={64} flex="row" gap={12} items="center" px={24} bg=${v("surface")} stroke=${v("border")} strokeWeights={{ top: 0, right: 0, bottom: 1, left: 0 }} strokeAlign="inside">
        ${T("Heading", heading, { size: 20, weight: 700, color: "text-primary" })}
        ${T("Description", desc, { size: 12, color: "text-tertiary" })}
        ${actions ? `<Frame name="Toolbar Actions" position="absolute" x={${view === "timeline" ? 804 : 999}} y={14} flex="row" gap={12} items="center">${actions}</Frame>` : ""}
      </Frame>
      ${content}
    </Frame>
  </Frame>
</Frame>`;
}

// ---- Board ----
const cards = {
  todo: [
    { Title: "要件を洗い出す", Priority: "中", Due: "未設定", Comments: "0" },
    { Title: "参考資料を集める", Priority: "低", Due: "未設定", Comments: "0", Assigned: false },
    { Title: "資格試験の申込", Priority: "高", Due: "12/20", Comments: "0", Assigned: false },
  ],
  in_progress: [
    { Title: "オンボーディング改善", Priority: "高", Due: "10/28", Comments: "2", Label: true },
    { Title: "ダッシュボードUI実装", Priority: "中", Due: "11/2", Comments: "0" },
  ],
  review: [{ Title: "通知設定の仕様確認", Priority: "緊急", Due: "10/30", Comments: "1" }],
  done: [{ Title: "ログインフロー改善", Priority: "中", Due: "10/22", Comments: "0" }],
};
const instance = (s, c) =>
  `<Instance of="Task Card" Status="${s.label}" w="fill" Title="${c.Title}" Priority="${c.Priority}" Due="${c.Due}" Comments="${c.Comments}" properties={{ 'Show label': '${c.Label ? "true" : "false"}', 'Assigned': '${c.Assigned === false ? "false" : "true"}' }} />`;
const column = (s) => `
<Frame name="${s.label} Column" grow={1} h="fill" flex="col" gap={10} p={12} rounded=${v("radius-md")} bg=${v("surface-sunken")} stroke=${v("border")} strokeWidth={1}>
  <Frame name="Header" w="fill" flex="row" gap={8} items="center" px={2} pb={4}>
    <Ellipse name="Dot" w={8} h={8} bg=${v(s.accent)} />
    ${T("Title", s.label, { weight: 700, color: "text-primary" })}
    <Frame name="Count" flex="row" px={7} rounded={10} bg=${v("surface-subtle")}>${T("Count Label", String(cards[s.key].length), { size: 11, weight: 600 })}</Frame>
  </Frame>
  ${cards[s.key].map((c) => instance(s, c)).join("")}
  <Frame name="Add Button" w="fill" h={34} flex="row" justify="center" items="center" rounded=${v("radius-sm")} stroke=${v("border-strong")} strokeWidth={1} bg=${v("surface")}>${T("Add Label", "＋ アイテムを追加", { size: 12, weight: 600 })}</Frame>
</Frame>`;
const crumbsRoadmap = (view) => [
  "開発用ワークスペース",
  "学習プロジェクト",
  "はじめてのロードマップ",
  view,
];
const board = (name = "Phase1 / ボード") =>
  shell({
    name,
    crumbs: crumbsRoadmap("ボード"),
    view: "board",
    heading: "ボード",
    desc: "カードをドラッグするか、ステータスと矢印で並べ替えます",
    actions: btnPrimary("新しいアイテムを追加"),
    content: `<Frame name="Kanban Area" w="fill" grow={1} flex="row" gap={16} py={20} px={24} items="start">${STATUS.map(column).join("")}</Frame>`,
  });

// ---- Timeline ----
const W = ["日", "月", "火", "水", "木", "金", "土"];
const start = new Date(Date.UTC(2026, 9, 21));
const days = Array.from({ length: 28 }, (_, i) => {
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + i);
  return d;
});
const weekend = (d) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
/** @type {Array<[string, string, string, boolean, {mark?:number,text?:string,bar?:number[],before?:boolean,note?:string,icon?:string}]>} */
const rows = [
  ["要件を洗い出す", "todo", "中", true, { mark: 14, text: "開始日のみ" }],
  ["オンボーディング改善", "in_progress", "高", true, { bar: [0, 7], before: true }],
  ["通知設定の仕様確認", "review", "緊急", true, { bar: [5, 9] }],
  ["ログインフロー改善", "done", "中", true, { bar: [1, 1] }],
  ["参考資料を集める", "todo", "低", false, { note: "日付未設定", icon: "calendar-off" }],
  ["ダッシュボードUI実装", "in_progress", "中", true, { bar: [3, 12] }],
  ["資格試験の申込", "todo", "高", false, { note: "表示期間外", icon: "calendar-clock" }],
];
const CW = 30.4; // (1440-240-48-2-300)/28
const cellsRow = (h, inner) => days.map((d, i) => inner(d, i)).join("");
const timelineGrid = `
<Frame name="Grid Card" w="fill" flex="col" rounded=${v("radius-md")} bg=${v("surface")} stroke=${v("border")} strokeWidth={1} overflow="hidden">
  <Frame name="Header Row" w="fill" h={48} flex="row" bg=${v("surface-sunken")} stroke=${v("border")} strokeWeights={{ top: 0, right: 0, bottom: 1, left: 0 }} strokeAlign="inside">
    <Frame name="Task Column Header" w={300} h="fill" flex="row" items="center" px={16} stroke=${v("border")} strokeWeights={{ top: 0, right: 1, bottom: 0, left: 0 }} strokeAlign="inside">${T("Label", "タスク", { size: 12, weight: 600 })}</Frame>
    ${cellsRow(48, (d, i) => `<Frame name="Day ${i}" grow={1} h="fill" flex="col" justify="center" items="center" gap={1}${i === 0 ? ` bg=${v("indigo-tint")}` : weekend(d) ? ` bg=${v("surface-subtle")}` : ""} stroke=${v("border")} strokeWeights={{ top: 0, right: ${i === 27 ? 0 : 1}, bottom: 0, left: 0 }} strokeAlign="inside">${T("W", W[d.getUTCDay()], { size: 9.5, color: i === 0 ? "indigo" : "text-tertiary" })}${T("D", i === 0 || d.getUTCDate() === 1 ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}` : String(d.getUTCDate()), { size: 11, weight: i === 0 ? 700 : undefined, color: i === 0 ? "indigo" : "text-secondary" })}</Frame>`)}
  </Frame>
  ${rows
    .map(([title, key, pr, assigned, p]) => {
      const s = STATUS.find((x) => x.key === key);
      const [pbg, pfg] = PRIORITY[pr];
      let overlay = "";
      if (p.bar) {
        const [a, b] = p.bar;
        const one = a === b;
        overlay = `<Frame name="Bar" position="absolute" x={${Math.round(a * CW) + (p.before ? 0 : 3)}} y={14} w={${Math.round((b - a + 1) * CW) - (p.before ? 3 : 6)}} h={28} flex="row" gap={4} items="center" px={8} bg=${v(s.tint)} ${p.before ? "roundedTR={6} roundedBR={6}" : `rounded={6} stroke=${v(s.accent)} strokeWeights={{ top: 0, right: 0, bottom: 0, left: 3 }} strokeAlign="inside"`} overflow="hidden">${p.before ? I("chevrons-left", 12, s.hex) : ""}${one ? "" : T("Bar Label", title, { size: 11, weight: 600, color: s.text })}</Frame>`;
      } else if (p.mark !== undefined) {
        overlay = `<Frame name="Marker" position="absolute" x={${Math.round(p.mark * CW) + 3}} y={14} h={28} flex="row" gap={6} items="center"><Frame name="Day Box" w={${Math.round(CW) - 6}} h={28} rounded={6} bg=${v(s.tint)} stroke=${v("text-secondary")} strokeWidth={1.5} />${T("Marker Text", p.text, { size: 11, weight: 600 })}</Frame>`;
      } else {
        overlay = `<Frame name="Note" position="absolute" x={12} y={20} flex="row" gap={6} items="center">${I(p.icon, 13, GRAY)}${T("Note Text", p.note, { size: 11, color: "text-tertiary" })}</Frame>`;
      }
      return `
  <Frame name="Row ${title}" w="fill" h={56} flex="row" stroke=${v("border")} strokeWeights={{ top: 0, right: 0, bottom: 1, left: 0 }} strokeAlign="inside">
    <Frame name="Task Cell" w={300} h="fill" flex="col" justify="center" gap={4} px={16} stroke=${v("border")} strokeWeights={{ top: 0, right: 1, bottom: 0, left: 0 }} strokeAlign="inside">
      ${T("Title", title, { weight: 600, color: "text-primary" })}
      <Frame name="Meta" flex="row" gap={6} items="center">
        ${assigned ? `<Frame name="Avatar" w={18} h={18} rounded={9} bg=${v("indigo")} flex="row" justify="center" items="center">${T("I", "開", { size: 9, weight: 600, hex: WHITE })}</Frame>` : `<Frame name="Avatar" w={18} h={18} rounded={9} stroke=${v("border-strong")} strokeWidth={1} strokeDash={[2, 2]} />`}
        <Frame name="Priority" flex="row" px={5} py={1} rounded={4} bg=${v(pbg)}>${T("P", pr, { size: 10, weight: 600, color: pfg })}</Frame>
        ${T("Status", s.label, { size: 11, color: "text-tertiary" })}
      </Frame>
    </Frame>
    <Frame name="Days" grow={1} h="fill" flex="row">
      ${cellsRow(56, (d, i) => `<Frame name="Cell" grow={1} h="fill"${i === 0 ? ' bg="#4F46E50D"' : weekend(d) ? ` bg=${v("surface-sunken")}` : ""} stroke=${v("border")} strokeWeights={{ top: 0, right: ${i === 27 ? 0 : 1}, bottom: 0, left: 0 }} strokeAlign="inside" />`)}
      ${overlay}
    </Frame>
  </Frame>`;
    })
    .join("")}
</Frame>`;
const navGroup = `
<Frame name="Range Nav" h={34} flex="row" rounded=${v("radius-sm")} bg=${v("surface")} stroke=${v("border-strong")} strokeWidth={1} overflow="hidden">
  <Frame name="Prev" h="fill" flex="row" gap={4} items="center" px={12} stroke=${v("border-strong")} strokeWeights={{ top: 0, right: 1, bottom: 0, left: 0 }} strokeAlign="inside">${I("chevron-left", 14, "#15181E")}${T("L", "前へ", { size: 12, weight: 600, color: "text-primary" })}</Frame>
  <Frame name="Today" h="fill" flex="row" items="center" px={12} stroke=${v("border-strong")} strokeWeights={{ top: 0, right: 1, bottom: 0, left: 0 }} strokeAlign="inside">${T("L", "今日", { size: 12, weight: 600, color: "text-primary" })}</Frame>
  <Frame name="Next" h="fill" flex="row" gap={4} items="center" px={12}>${T("L", "次へ", { size: 12, weight: 600, color: "text-primary" })}${I("chevron-right", 14, "#15181E")}</Frame>
</Frame>`;
const timeline = shell({
  name: "Phase1 / タイムライン",
  crumbs: crumbsRoadmap("タイムライン"),
  view: "timeline",
  heading: "タイムライン",
  desc: "28日間の予定を表示。期間はタスク詳細から編集します",
  actions: navGroup + btnPrimary("新しいアイテムを追加"),
  content: `<Frame name="Timeline Area" w="fill" grow={1} flex="col" gap={12} py={16} px={24}>
    <Frame name="Range Row" flex="row" gap={8} items="center">${I("calendar-range", 16, GRAY)}${T("Range Text", "2026/10/21 〜 2026/11/17", { weight: 600, color: "text-primary" })}${T("Count", "· 7件のタスク", { size: 12, color: "text-tertiary" })}</Frame>
    ${timelineGrid}
  </Frame>`,
});

// ---- Roadmap list ----
const listRow = (name, color, last) =>
  `<Frame name="Row ${name}" w="fill" h={56} flex="row" gap={12} items="center" px={16}${last ? "" : ` stroke=${v("border")} strokeWeights={{ top: 0, right: 0, bottom: 1, left: 0 }} strokeAlign="inside"`}>
    <Frame name="Icon" w={32} h={32} rounded={8} bg=${v("surface-subtle")} flex="row" justify="center" items="center">${I("map", 16, color)}</Frame>
    ${T("Name", name, { size: 14, weight: 600, color: "text-primary" })}
    <Frame name="Spacer" grow={1} h={1} />
    <Frame name="Open" flex="row" gap={4} items="center">${T("Open Label", "ボードを開く", { size: 12, weight: 600, color: "indigo" })}${I("arrow-right", 14, IND)}</Frame>
    <Frame name="Edit" w={32} h={32} rounded=${v("radius-sm")} flex="row" justify="center" items="center" bg=${v("surface")} stroke=${v("border-strong")} strokeWidth={1}>${I("pencil", 14, "#15181E")}</Frame>
  </Frame>`;
const inputBox = (value, { error, focus, placeholder } = {}) =>
  `<Frame name="Input" w="fill" h={36} flex="row" items="center" px={12} rounded=${v("radius-sm")} bg=${v("surface")} stroke=${error ? '"#D92D20"' : focus ? v("indigo") : v("border-strong")} strokeWidth={${error || focus ? 1.5 : 1}}>${T("Value", value, { color: placeholder ? "text-tertiary" : "text-primary" })}</Frame>`;
const roadmaps = shell({
  name: "Phase1 / ロードマップ一覧・作成",
  crumbs: ["開発用ワークスペース", "学習プロジェクト"],
  view: "list",
  roadmap: false,
  heading: "ロードマップ",
  desc: "学習プロジェクトのロードマップを作成・名称変更します",
  content: `<Frame name="Content" w="fill" grow={1} flex="col" p={24}>
  <Frame name="Column" w={768} flex="col" gap={20}>
    <Frame name="Roadmap List" w="fill" flex="col" rounded=${v("radius-md")} bg=${v("surface")} stroke=${v("border")} strokeWidth={1} overflow="hidden">
      <Frame name="List Header" w="fill" flex="row" gap={8} items="center" py={12} px={16} bg=${v("surface-sunken")} stroke=${v("border")} strokeWeights={{ top: 0, right: 0, bottom: 1, left: 0 }} strokeAlign="inside">${T("Label", "ロードマップ", { size: 12, weight: 600 })}<Frame name="Count" flex="row" px={7} rounded={10} bg=${v("surface-subtle")}>${T("N", "3", { size: 11, weight: 600 })}</Frame></Frame>
      ${listRow("はじめてのロードマップ", IND)}
      <Frame name="Row Editing" w="fill" flex="row" gap={12} items="start" py={12} px={16} bg=${v("surface-sunken")} stroke=${v("border")} strokeWeights={{ top: 0, right: 0, bottom: 1, left: 0 }} strokeAlign="inside">
        <Frame name="Icon" w={32} h={32} rounded={8} bg=${v("surface-subtle")} flex="row" justify="center" items="center">${I("map", 16, "#0D9488")}</Frame>
        <Frame name="Field" grow={1} flex="col" gap={6}>${inputBox("英語学習 2026", { focus: true })}${T("Hint", "Enterで保存、Escでキャンセル", { size: 11, color: "text-tertiary" })}</Frame>
        ${btnPrimary("保存", null)}
        <Frame name="Cancel" h={36} flex="row" items="center" px={12} rounded=${v("radius-sm")}>${T("L", "キャンセル", { weight: 600, color: "text-primary" })}</Frame>
      </Frame>
      ${listRow("資格試験の準備", "#B45309", true)}
    </Frame>
    <Frame name="Create Card" w="fill" flex="col" gap={12} p={16} rounded=${v("radius-md")} bg=${v("surface")} stroke=${v("border")} strokeWidth={1}>
      <Frame name="Heading" flex="col" gap={4}>${T("Title", "新しいロードマップ", { size: 14, weight: 700, color: "text-primary" })}${T("Desc", "作成すると、そのロードマップのボードが開きます。", { size: 12, color: "text-tertiary" })}</Frame>
      <Frame name="Form Row" w="fill" flex="row" gap={8} items="start">
        <Frame name="Field" grow={1} flex="col" gap={6}>
          ${T("Label", "ロードマップの名称", { size: 12, weight: 600, color: "text-primary" })}
          ${inputBox("ロードマップの名称", { error: true, placeholder: true })}
          <Frame name="Error" flex="row" gap={4} items="center">${I("circle-alert", 13, "#B42318")}${T("Msg", "名称を入力してください", { size: 12, color: "danger" })}</Frame>
        </Frame>
        <Frame name="Create Wrap" flex="col" pt={23}>${btnPrimary("作成")}</Frame>
      </Frame>
    </Frame>
  </Frame>
</Frame>`,
});

// ---- Task editor modal (over the board) ----
const field = (label, value, { icon, select, error, h, placeholder } = {}) => `
<Frame name="${label}" w="fill" flex="col" gap={6}>
  ${T("Label", label, { size: 12, weight: 600, color: "text-primary" })}
  <Frame name="Input" w="fill" h={${h ?? 36}} flex="row" gap={8} items="${h ? "start" : "center"}" ${h ? "py={10} " : ""}px={12} rounded=${v("radius-sm")} bg=${v("surface-sunken")} stroke=${error ? '"#D92D20"' : v("border-strong")} strokeWidth={${error ? 1.5 : 1}}>
    ${icon ? I(icon, 14, GRAY) : ""}${T("Value", value, { color: placeholder ? "text-tertiary" : "text-primary", extra: 'w="fill"' })}${select ? I("chevron-down", 14, GRAY) : ""}
  </Frame>
  ${error ? `<Frame name="Error" w="fill" flex="row" gap={4} items="start">${I("circle-alert", 13, "#B42318")}${T("M", error, { size: 12, color: "danger", extra: 'w="fill"' })}</Frame>` : ""}
</Frame>`;
const labelOption = (n, color, on) =>
  `<Frame name="Option ${n}" flex="row" gap={6} items="center" px={10} py={4} rounded={16} stroke=${on ? v("indigo") : v("border-strong")} strokeWidth={1}${on ? ` bg=${v("indigo-tint")}` : ""}>${I(on ? "square-check" : "square", 14, on ? IND : GRAY)}<Ellipse name="Dot" w={7} h={7} bg="${color}" />${T("N", n, { size: 12, weight: on ? 600 : undefined, color: on ? "indigo" : "text-secondary" })}</Frame>`;
const modal = `
<Frame name="Phase1 / タスク詳細・編集" w={1440} h={900} bg="#96989D" flex="row" justify="center" items="center">
  <Frame name="Modal" w={640} flex="col" rounded=${v("radius-lg")} bg=${v("surface")} overflow="hidden" shadow="0 16 40 #15181E33">
    <Frame name="Modal Header" w="fill" flex="row" gap={12} items="start" pt={20} px={24} pb={4}>
      <Frame name="Heading Group" grow={1} flex="col" gap={4}>${T("Title", "タスクを編集", { size: 18, weight: 700, color: "text-primary" })}${T("Subtitle", "タスクの基本情報を編集します。進捗 33% · コメント 2", { size: 12, color: "text-tertiary" })}</Frame>
      <Frame name="Close" w={32} h={32} rounded=${v("radius-sm")} flex="row" justify="center" items="center">${I("x", 16, SEC)}</Frame>
    </Frame>
    <Frame name="Form" w="fill" flex="col" gap={14} pt={12} px={24} pb={16}>
      <Frame name="Conflict Banner" w="fill" flex="row" gap={10} items="center" py={10} px={12} rounded=${v("radius-sm")} bg=${v("amber-tint")} stroke="#F3D3A4" strokeWidth={1}>
        ${I("triangle-alert", 16, "#B45309")}
        ${T("Msg", "他のユーザーが先に更新しました。入力内容は残っています。", { size: 12, color: "amber", extra: 'w="fill"' })}
        <Frame name="Reload" flex="row" gap={4} items="center" px={10} py={5} rounded=${v("radius-sm")} bg=${v("surface")} stroke="#F3D3A4" strokeWidth={1}>${I("refresh-cw", 12, "#B45309")}${T("L", "最新の内容を読み込む（入力を置き換えます）", { size: 11, weight: 600, color: "amber" })}</Frame>
      </Frame>
      ${field("タイトル（必須）", "オンボーディング改善")}
      ${field("説明", "初回ログイン後のガイドを3ステップに整理し、離脱率を計測する。", { h: 72 })}
      <Frame name="Row Assignee" w="fill" flex="row" gap={12} items="start">${field("担当者", "開発ユーザー", { icon: "user", select: true })}${field("開始日", "2026/10/14", { icon: "calendar" })}${field("期限", "2026/10/12", { icon: "calendar", error: "開始日以前にならない期限を入力してください" })}</Frame>
      <Frame name="Row Status" w="fill" flex="row" gap={12}>${field("ステータス", "進行中", { icon: "circle-dot", select: true })}${field("優先度", "高", { icon: "flag", select: true })}</Frame>
      <Frame name="ラベル" w="fill" flex="col" gap={8}>${T("Label", "ラベル", { size: 12, weight: 600, color: "text-primary" })}<Frame name="Label Options" flex="row" gap={8}>${labelOption("基礎", "#3B82F6", true)}${labelOption("調査", "#0D9488", false)}${labelOption("バグ", "#D92D20", false)}</Frame></Frame>
    </Frame>
    <Frame name="Footer" w="fill" flex="row" gap={8} justify="end" items="center" py={14} px={24} bg=${v("surface-sunken")} stroke=${v("border")} strokeWeights={{ top: 1, right: 0, bottom: 0, left: 0 }} strokeAlign="inside">${btnOutline("キャンセル")}${btnPrimary("保存", null)}</Frame>
  </Frame>
</Frame>`;

// ---- States ----
const panel = (caption, inner) =>
  `<Frame name="${caption}" grow={1} flex="col" gap={8}>${T("Caption", caption, { size: 11, weight: 600, color: "text-tertiary" })}<Frame name="Panel" w="fill" h={240} flex="col" gap={10} p={24} justify="center" items="center" rounded=${v("radius-md")} bg=${v("surface")} stroke=${v("border")} strokeWidth={1}>${inner}</Frame></Frame>`;
const stateIcon = (icon, bg, fg) =>
  `<Frame name="Icon Wrap" w={44} h={44} rounded={22} bg=${v(bg)} flex="row" justify="center" items="center">${I(icon, 20, fg)}</Frame>`;
const stateText = (title, desc) =>
  T("Title", title, { size: 14, weight: 700, color: "text-primary" }) +
  T("Desc", desc, {
    size: 12,
    color: "text-tertiary",
    extra: 'w={300} textAlign="center" lineHeight={18}',
  });
const notice = (name, icon, bg, fg, text, action = "") =>
  `<Frame name="${name}" w="fill" flex="row" gap={10} items="center" py={10} px={12} rounded=${v("radius-sm")} bg=${bg}>${I(icon, 16, fg)}${T("M", text, { size: 12, hex: fg, extra: 'w="fill"' })}${action}</Frame>`;
const states = `
<Frame name="Phase1 / 状態・競合" w={1440} h="hug" flex="col" gap={24} p={40} bg=${v("bg-app")}>
  ${T("Heading", "共通の状態表示", { size: 20, weight: 700, color: "text-primary" })}
  <Frame name="Row 1" w="fill" flex="row" gap={20}>
    ${panel("読み込み中", `<Frame name="Skeleton" w="fill" flex="col" gap={10}><Rectangle name="Bar" w={176} h={12} rounded={6} bg=${v("surface-subtle")} /><Rectangle name="Bar" w="fill" h={12} rounded={6} bg=${v("surface-subtle")} /><Rectangle name="Bar" w={224} h={12} rounded={6} bg=${v("surface-subtle")} /></Frame>${T("Label", "読み込み中…", { size: 12, color: "text-tertiary" })}`)}
    ${panel("0件", stateIcon("inbox", "indigo-tint", IND) + stateText("ロードマップがまだありません", "名称をつけて作成すると、タスクを追加できます。"))}
    ${panel("取得失敗", stateIcon("cloud-off", "danger-tint", "#B42318") + stateText("読み込めませんでした", "通信状況を確認して、もう一度お試しください。") + btnOutline("再試行", "refresh-cw", 32))}
  </Frame>
  <Frame name="Row 2" w="fill" flex="row" gap={20}>
    ${panel("権限なし・対象なし", stateIcon("search-x", "indigo-tint", IND) + stateText("ページが見つかりません", "指定された対象が存在しないか、アクセスできません。") + btnOutline("トップへ戻る", null, 32))}
    <Frame name="ボード上部の通知" grow={1} flex="col" gap={8}>${T("Caption", "ボード上部の通知（移動失敗・保存中・補足）", { size: 11, weight: 600, color: "text-tertiary" })}
      <Frame name="Panel" w="fill" h={240} flex="col" gap={12} p={24} justify="center" rounded=${v("radius-md")} bg=${v("surface")} stroke=${v("border")} strokeWidth={1}>
        ${notice("Error", "circle-alert", '"#FDECEC"', "#B42318", "移動を保存できませんでした。元の位置に戻しました。", `<Frame name="Retry" flex="row" gap={4} items="center" px={10} py={5} rounded=${v("radius-sm")} bg=${v("surface")} stroke="#F6C9C5" strokeWidth={1}>${I("refresh-cw", 12, "#B42318")}${T("L", "再試行", { size: 11, weight: 600, color: "danger" })}</Frame>`)}
        ${notice("Saving", "loader-circle", v("indigo-tint"), IND, "移動を保存中…")}
        ${notice("Info", "info", v("surface-subtle"), SEC, "担当者・ラベルの表示を取得できませんでした。")}
      </Frame>
    </Frame>
  </Frame>
</Frame>`;

const map = createMapDesign({ shell, T, I, v, cards, STATUS, btnOutline, btnPrimary });

for (const [file, jsx] of Object.entries({
  components,
  board: board(),
  timeline,
  roadmaps,
  modal,
  states,
  map,
}))
  writeFileSync(join(outputDirectory, `${file}.jsx`), jsx);
console.log("ok");
