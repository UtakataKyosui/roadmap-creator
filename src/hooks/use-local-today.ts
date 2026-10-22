import { useSyncExternalStore } from "react";
import { todayCalendarDate } from "@roadmapper/domain/calendar-date";

const subscribe = (notify: () => void) => {
  const timer = window.setInterval(notify, 60_000);
  return () => window.clearInterval(timer);
};

// SSRとハイドレーションではloaderの日付を共有し、その後は閲覧者の暦日を使う。
export const useLocalToday = (initialToday: string) =>
  useSyncExternalStore(subscribe, todayCalendarDate, () => initialToday);
