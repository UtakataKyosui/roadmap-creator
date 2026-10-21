// OpenPencil用。中央のロードマップと周囲のタスクを直接つなぐグラフ。
export function createMapDesign({ shell, T, I, v, cards, STATUS, btnOutline, btnPrimary }) {
  const port = (x, y) =>
    `<Ellipse name="Connection Port" x={${x - 4}} y={${y - 4}} w={8} h={8} bg="#C4CBD8" stroke="#FFFFFF" strokeWidth={2}/>`;
  const line = (x1, y1, x2, y2) => {
    const width = Math.hypot(x2 - x1, y2 - y1);
    return `<Rectangle name="Roadmap Connection" x={${(x1 + x2 - width) / 2}} y={${(y1 + y2) / 2 - 1}} w={${width}} h={2} rotation={${(Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI}} bg="#9AA5B8"/>`;
  };
  const dots = Array.from({ length: 38 }, (_, r) =>
    Array.from({ length: 59 }, (_, c) => `M${20 + c * 20} ${20 + r * 20}h0.01`).join(" "),
  ).join(" ");
  const items = STATUS.flatMap((status) => cards[status.key].map((task) => ({ status, task })));
  const locations = items.map((item, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / items.length;
    return {
      ...item,
      cx: 600 + Math.cos(angle) * 450,
      cy: 390 + Math.sin(angle) * 260,
      vertical: Math.abs(Math.sin(angle)) > 0.8,
    };
  });
  const edges = locations
    .map(({ cx, cy, vertical }) => {
      const sx = vertical ? 600 : cx < 600 ? 480 : 720;
      const sy = vertical ? (cy < 390 ? 330 : 450) : 390;
      const tx = vertical ? cx : cx < 600 ? cx + 110 : cx - 110;
      const ty = vertical ? (cy < 390 ? cy + 70 : cy - 70) : cy;
      return line(sx, sy, tx, ty) + port(sx, sy) + port(tx, ty);
    })
    .join("");
  const nodes = locations
    .map(({ task, status, cx, cy }) => {
      const x = Math.round(cx - 110),
        y = Math.round(cy - 70);
      const high = task.Priority === "高",
        urgent = task.Priority === "緊急";
      return `<Frame name="Task ${task.Title}" x={${x}} y={${y}} w={220} h={140} flex="col" gap={9} p={12} bg=${v("surface")} rounded={14} stroke=${v("border")} strokeWidth={1} shadow="0 2 8 #15181E08">
            <Frame name="Meta" w="fill" flex="row" items="center"><Frame name="Priority" px={5} py={2} rounded={4} flex="row" bg=${v(high ? "amber-tint" : urgent ? "danger-tint" : "surface-subtle")}>${T("Priority Label", task.Priority, { size: 10, weight: 600, color: high ? "amber" : urgent ? "danger" : "text-secondary" })}</Frame><Frame name="Spacer" grow={1} h={1}/>${T("Status", status.label, { size: 10, color: "text-tertiary" })}</Frame>
            ${T("Title", task.Title, { size: 12, weight: 600, color: "text-primary", extra: 'w="fill"' })}
            <Frame name="Label Row" w="fill" h={18} flex="row">${task.Label ? `<Frame name="Label" flex="row" px={5} py={2} rounded={4} bg=${v("indigo-tint")}>${T("Label Text", "● 基礎", { size: 9, color: "indigo" })}</Frame>` : ""}</Frame>
            <Frame name="Footer" w="fill" flex="row" gap={5} items="center" pt={8} stroke=${v("border")} strokeWeights={{top:1,right:0,bottom:0,left:0}}>${I("calendar-days", 11, "#8C95A6")}${T("Due", task.Due, { size: 10, color: "text-tertiary" })}<Frame name="Spacer" grow={1} h={1}/>${I("message-square", 11, "#8C95A6")}${T("Comments", "0", { size: 10, color: "text-tertiary" })}<Ellipse name="Assignee" w={18} h={18} bg=${task.Assigned === false ? v("surface") : v("indigo")} stroke=${v("border-strong")} strokeWidth={1}/></Frame>
          </Frame>`;
    })
    .join("");
  const mini = locations
    .map(
      ({ cx, cy, status }) =>
        `<Rectangle name="Mini Task" x={${15 + (cx - 40) * 0.12}} y={${15 + cy * 0.13}} w={25} h={14} rounded={3} bg="${status.key === "done" ? "#0D9488" : "#A5A0ED"}"/>`,
    )
    .join("");
  return shell({
    name: "Phase1 / マップ",
    crumbs: ["開発用ワークスペース", "学習プロジェクト", "はじめてのロードマップ", "マップ"],
    view: "map",
    heading: "マップ",
    desc: "全体を見渡し、次の一歩を決めましょう",
    actions: btnOutline("配置を整える", "rotate-ccw", 32) + btnPrimary("タスクを追加", "plus", 32),
    content: `<Frame name="Graph Canvas" w="fill" grow={1} bg=${v("bg-app")} overflow="hidden">
      <svg name="Dot Grid" w={1200} h={780} viewBox="0 0 1200 780"><path d="${dots}" fill="none" stroke="#CED4DF" strokeWidth={2} strokeLinecap="round"/></svg>
      ${edges}${nodes}
      <Frame name="Roadmap Summary" x={480} y={330} w={240} h={120} flex="col" gap={9} p={16} bg=${v("surface")} rounded={14} stroke="#CBC8F7" strokeWidth={1} shadow="0 6 24 #4F46E50D">
        <Frame name="Eyebrow" flex="row" gap={6} items="center">${I("git-branch", 13, "#4F46E5")}${T("Label", "ROADMAP", { size: 10, weight: 600, color: "indigo" })}</Frame>
        ${T("Title", "はじめてのロードマップ", { size: 13, weight: 700, color: "text-primary" })}
        <Frame name="Progress" w="fill" flex="row">${T("Total", "1 / 7 タスク完了", { size: 10 })}<Frame name="Spacer" grow={1} h={1}/>${T("Percent", "14%", { size: 10, weight: 600, color: "indigo" })}</Frame>
        <Frame name="Track" w="fill" h={4} rounded={2} bg=${v("indigo-tint")}><Rectangle name="Fill" w={29} h={4} rounded={2} bg=${v("indigo")}/></Frame>
      </Frame>
      <Frame name="Legend" x={20} y={20} w={250} flex="col" gap={8} p={12} rounded={10} bg=${v("surface")} stroke=${v("border")} strokeWidth={1}>${T("Title", "ロードマップの全体像", { size: 11, weight: 600, color: "text-primary" })}<Frame name="Items" flex="row" gap={10}>${STATUS.map((s) => T("Status", s.label, { size: 9, hex: s.hex })).join("")}</Frame></Frame>
      <Frame name="Zoom Controls" x={20} y={650} w={34} flex="col" bg=${v("surface")} rounded={8} stroke=${v("border")} strokeWidth={1}>${["plus", "minus", "maximize"].map((icon) => `<Frame name="${icon}" w={34} h={34} flex="row" items="center" justify="center">${I(icon, 14, "#5A6476")}</Frame>`).join("")}</Frame>
      <Frame name="Help" x={350} y={735} flex="row" px={14} py={7} rounded={20} bg=${v("surface")} stroke=${v("border")} strokeWidth={1}>${T("Hint", "線はロードマップへの所属 · 配置はこの画面内のみ", { size: 10 })}</Frame>
      <Frame name="MiniMap" x={1010} y={620} w={170} h={130} rounded={10} bg=${v("surface")} stroke=${v("border")} strokeWidth={1}>${mini}<Rectangle name="Mini Roadmap" x={73} y={62} w={28} h={16} rounded={3} bg="#4F46E5"/></Frame>
    </Frame>`,
  }).replace("x={999}", "x={880}");
}
