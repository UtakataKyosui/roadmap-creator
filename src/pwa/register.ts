// 本番ビルドでのみService Workerを登録する。開発時はHMRと干渉するため登録しない。
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
    console.warn("Service Workerの登録に失敗しました", error);
  });
}
