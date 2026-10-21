// OpenPencil用。既存画面と同じトークン・シェルを使うキャンバスの画面案。
export function createMapDesign({ shell, T, I, v, cards, STATUS, btnOutline, btnPrimary }) {
  const port = (x, y) =>
    `<Ellipse name="Connection Port" x={${x - 4}} y={${y - 4}} w={8} h={8} bg="#C4CBD8" stroke="#FFFFFF" strokeWidth={2} />`;
  const line = (x1, y1, x2, y2) =>
    `<Rectangle name="Classification Edge" x={${Math.min(x1, x2) - (x1 === x2 ? 1 : 0)}} y={${Math.min(y1, y2) - (y1 === y2 ? 1 : 0)}} w={${Math.max(2, Math.abs(x2 - x1))}} h={${Math.max(2, Math.abs(y2 - y1))}} bg="#9AA5B8" />`;
  const dots = Array.from({ length: 38 }, (_, row) =>
    Array.from({ length: 59 }, (_, col) => `M${20 + col * 20} ${20 + row * 20}h0.01`).join(" "),
  ).join(" ");
  const nodes = STATUS.map((status, column) => {
    const x = 60 + column * 280;
    const items = cards[status.key];
    return (
      line(600, 150, 600, 180) +
      line(600, 180, x + 110, 180) +
      line(x + 110, 180, x + 110, 200) +
      `<Frame name="Group ${status.label}" x={${x}} y={200} w={220} h={40} flex="row" gap={8} items="center" px={14} bg=${v("surface")} rounded={10} stroke=${v("border")} strokeWidth={1}>
        <Ellipse name="Status Dot" w={7} h={7} bg=${v(status.accent)} />${T("Status", status.label, { size: 12, weight: 700, color: "text-primary" })}
        <Frame name="Spacer" grow={1} h={1}/>${T("Count", String(items.length), { size: 11 })}
      </Frame>` +
      port(x + 110, 200) +
      port(x, 220) +
      items
        .map((task, row) => {
          const y = 286 + row * 160;
          const high = task.Priority === "高",
            urgent = task.Priority === "緊急";
          return (
            line(x, 220, x - 22, 220) +
            line(x - 22, 220, x - 22, y + 68) +
            line(x - 22, y + 68, x, y + 68) +
            `<Frame name="Task ${task.Title}" x={${x}} y={${y}} w={220} h={140} flex="col" gap={9} p={12} bg=${v("surface")} rounded={10} stroke=${v("border")} strokeWidth={1} shadow="0 2 8 #15181E08">
            <Frame name="Meta" w="fill" flex="row" items="center"><Frame name="Priority" px={5} py={2} rounded={4} flex="row" bg=${v(high ? "amber-tint" : urgent ? "danger-tint" : "surface-subtle")}>${T("Priority Label", task.Priority, { size: 10, weight: 600, color: high ? "amber" : urgent ? "danger" : "text-secondary" })}</Frame><Frame name="Spacer" grow={1} h={1}/>${T("Status", status.label, { size: 10, color: "text-tertiary" })}</Frame>
            ${T("Title", task.Title, { size: 12, weight: 600, color: "text-primary", extra: 'w="fill"' })}
            <Frame name="Label Row" w="fill" h={18} flex="row">${task.Label ? `<Frame name="Label" flex="row" px={5} py={2} rounded={4} bg=${v("indigo-tint")}>${T("Label Text", "● 基礎", { size: 9, color: "indigo" })}</Frame>` : ""}</Frame>
            <Frame name="Footer" w="fill" flex="row" gap={5} items="center" pt={8} stroke=${v("border")} strokeWeights={{top:1,right:0,bottom:0,left:0}}>${I("calendar-days", 11, "#8C95A6")}${T("Due", task.Due, { size: 10, color: "text-tertiary" })}<Frame name="Spacer" grow={1} h={1}/>${I("message-square", 11, "#8C95A6")}${T("Comments", "0", { size: 10, color: "text-tertiary" })}<Ellipse name="Assignee" w={18} h={18} bg=${task.Assigned === false ? v("surface") : v("indigo")} stroke=${v("border-strong")} strokeWidth={1}/></Frame>
          </Frame>` +
            port(x, y + 68)
          );
        })
        .join("")
    );
  }).join("");
  const map = shell({
    name: "Phase1 / マップ",
    crumbs: ["開発用ワークスペース", "学習プロジェクト", "はじめてのロードマップ", "マップ"],
    view: "map",
    heading: "マップ",
    desc: "全体を見渡し、次の一歩を決めましょう",
    actions: btnOutline("配置を整える", "rotate-ccw", 32) + btnPrimary("タスクを追加", "plus", 32),
    content: `<Frame name="Node Canvas" w="fill" grow={1} bg=${v("bg-app")} overflow="hidden">
      <svg name="Dot Grid" w={1200} h={780} viewBox="0 0 1200 780"><path d="${dots}" fill="none" stroke="#CED4DF" strokeWidth={2} strokeLinecap="round" /></svg>
      ${nodes}
      <Frame name="Roadmap Summary" x={480} y={30} w={240} h={120} flex="col" gap={9} p={16} bg=${v("surface")} rounded={14} stroke="#CBC8F7" strokeWidth={1} shadow="0 6 24 #4F46E50D">
        <Frame name="Eyebrow" flex="row" gap={6} items="center">${I("git-branch", 13, "#4F46E5")}${T("Label", "ROADMAP", { size: 10, weight: 600, color: "indigo" })}</Frame>
        ${T("Title", "はじめてのロードマップ", { size: 13, weight: 700, color: "text-primary" })}
        <Frame name="Progress" w="fill" flex="row">${T("Total", "1 / 7 タスク完了", { size: 10 })}<Frame name="Spacer" grow={1} h={1}/>${T("Percent", "14%", { size: 10, weight: 600, color: "indigo" })}</Frame>
        <Frame name="Track" w="fill" h={4} rounded={2} bg=${v("indigo-tint")}><Rectangle name="Progress Fill" w={29} h={4} rounded={2} bg=${v("indigo")}/></Frame>
      </Frame>${port(600, 150)}
      <Frame name="Legend" x={20} y={20} w={250} flex="col" gap={8} p={12} rounded={10} bg=${v("surface")} stroke=${v("border")} strokeWidth={1}>${T("Title", "ステータスで全体を整理", { size: 11, weight: 600, color: "text-primary" })}<Frame name="Items" flex="row" gap={10}>${STATUS.map((s) => T("Status", s.label, { size: 9, hex: s.hex })).join("")}</Frame></Frame>
      <Frame name="Zoom Controls" x={20} y={650} w={34} flex="col" bg=${v("surface")} rounded={8} stroke=${v("border")} strokeWidth={1}>${["plus", "minus", "maximize"].map((icon) => `<Frame name="${icon}" w={34} h={34} flex="row" items="center" justify="center">${I(icon, 14, "#5A6476")}</Frame>`).join("")}</Frame>
      <Frame name="Help" x={350} y={735} flex="row" px={14} py={7} rounded={20} bg=${v("surface")} stroke=${v("border")} strokeWidth={1}>${T("Hint", "線は分類を表示 · ドラッグで配置 · 配置はこの画面内のみ", { size: 10 })}</Frame>
      <Frame name="MiniMap" x={1010} y={620} w={170} h={130} rounded={10} bg=${v("surface")} stroke=${v("border")} strokeWidth={1}>${STATUS.map((s, i) => `<Rectangle name="Mini Group" x={${15 + i * 37}} y={30} w={28} h={10} rounded={2} bg="#A5A0ED"/>${cards[s.key].map((_, j) => `<Rectangle name="Mini Task" x={${15 + i * 37}} y={${48 + j * 20}} w={28} h={15} rounded={2} bg="${s.key === "done" ? "#0D9488" : "#A5A0ED"}"/>`).join("")}`).join("")}</Frame>
    </Frame>`,
  });
  return map.replace("x={999}", "x={880}");
}
