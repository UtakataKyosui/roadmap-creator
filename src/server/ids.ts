// 画面のURL検証でも使う純粋関数のためdomainに置き、サーバーからはここ経由で参照する。
export { isUuid } from "@roadmapper/domain/ids";

let lastTimestamp = 0;

// 先頭48bitがミリ秒のUNIX時刻になるUUID v7。時刻を指定しない限り、同じミリ秒内でも生成順に昇順になる。
export const uuidv7 = (explicitTimestamp?: number) => {
  const timestamp = explicitTimestamp ?? (lastTimestamp = Math.max(Date.now(), lastTimestamp + 1));
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[0] = Math.floor(timestamp / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(timestamp / 2 ** 32) & 0xff;
  bytes[2] = (timestamp >>> 24) & 0xff;
  bytes[3] = (timestamp >>> 16) & 0xff;
  bytes[4] = (timestamp >>> 8) & 0xff;
  bytes[5] = timestamp & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const nowIso = () => new Date().toISOString();
