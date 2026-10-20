import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { nextLocalMidnight } from "../../study-clock";

export function useStudyClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 30000);
    const subscription = AppState.addEventListener("change", refresh);
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(1, nextLocalMidnight(now) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [now]);
  return now;
}
