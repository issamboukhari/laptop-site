"use client";

/**
 * Global error boundary — last-resort fallback when the root layout itself
 * fails. Must render its own <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
          Something went seriously wrong
        </h1>
        <p style={{ color: "#a1a1aa", fontSize: "0.875rem", marginTop: "0.5rem" }}>
          {error?.digest ? `Ref: ${error.digest}` : "The application failed to render."}
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            height: "2.75rem",
            padding: "0 1.5rem",
            borderRadius: "0.75rem",
            border: "none",
            background: "#8b5cf6",
            color: "#fff",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          إعادة المحاولة · Retry
        </button>
      </body>
    </html>
  );
}
