// タイムゾーンを持たない日付（YYYY-MM-DD）。UTCの0時として扱い、端末のタイムゾーンで日がずれないようにする。
const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export const parseCalendarDate = (value: string) => {
  const match = PATTERN.exec(value);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  // 2月30日のような存在しない日付を弾く。
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return time;
};

export const toCalendarDate = (time: number) => new Date(time).toISOString().slice(0, 10);

// 閲覧者の端末の暦日。表示と期限超過の判定にだけ使う。
export const todayCalendarDate = (now = new Date()) =>
  toCalendarDate(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

export const addDays = (value: string, days: number) => {
  const time = parseCalendarDate(value);
  return time === null ? value : toCalendarDate(time + days * DAY_MS);
};

// 開始日と期限日を含めた日数。日付が不正、または期限が開始日より前ならnull。
export const inclusiveDays = (start: string, end: string) => {
  const from = parseCalendarDate(start);
  const to = parseCalendarDate(end);
  if (from === null || to === null || to < from) return null;
  return (to - from) / DAY_MS + 1;
};

export const diffDays = (from: string, to: string) => {
  const a = parseCalendarDate(from);
  const b = parseCalendarDate(to);
  return a === null || b === null ? null : (b - a) / DAY_MS;
};

export const isOverdue = (dueDate: string | null, status: string, today: string) =>
  dueDate !== null && status !== "done" && dueDate < today;

export const formatShortDate = (value: string | null) => {
  if (value === null) return "未設定";
  const time = parseCalendarDate(value);
  if (time === null) return value;
  const date = new Date(time);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
};

export const hasValidDateRange = (range: { startDate?: string | null; dueDate?: string | null }) =>
  !range.startDate || !range.dueDate || range.startDate <= range.dueDate;
