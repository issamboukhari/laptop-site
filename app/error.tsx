"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";

/**
 * Route-level error boundary — catches any render/data crash inside the app
 * and shows an elegant fallback with a Retry button instead of a broken page.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Live online/offline status without effects: the store subscribes to
  // browser network events; server snapshot is online (matches SSR HTML).
  const online = useSyncExternalStore(
    (notify) => {
      window.addEventListener("online", notify);
      window.addEventListener("offline", notify);
      return () => {
        window.removeEventListener("online", notify);
        window.removeEventListener("offline", notify);
      };
    },
    () => navigator.onLine,
    () => true
  );

  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-24 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-red-500/10 border border-red-500/20">
        {online ? (
          <AlertTriangle className="w-8 h-8 text-red-400" />
        ) : (
          <WifiOff className="w-8 h-8 text-red-400" />
        )}
      </div>

      <h2 className="text-xl font-semibold text-gen-fg">
        {online ? "حدث خطأ غير متوقع" : "لا يوجد اتصال بالشبكة"}
      </h2>

      <p className="text-sm text-gen-muted mt-2 max-w-sm leading-relaxed">
        {online
          ? "Something went wrong while loading this section. Your saved data is safe — try again."
          : "تحقق من اتصالك بالإنترنت ثم أعد المحاولة — بياناتك المحفوظة آمنة."}
      </p>

      <button
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-gen-accent text-white text-sm font-semibold hover:bg-gen-accent-light transition-colors cursor-pointer"
      >
        <RefreshCw className="w-4 h-4" />
        إعادة المحاولة
      </button>
    </div>
  );
}
