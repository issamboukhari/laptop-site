import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration — wraps the gen web app into a native Android shell.
 *
 * The app is a dynamic Next.js server (API routes + RSC), so the WebView loads
 * the running server URL instead of static files:
 *
 *  - Development on an Android emulator: http://10.0.2.2:3001 (host machine).
 *  - Production: set CAPACITOR_SERVER_URL to your deployed https:// URL before
 *    running `npx cap sync android`, e.g.
 *      CAPACITOR_SERVER_URL=https://gen.example.com npx cap sync android
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL ?? "http://10.0.2.2:3001";
const isLocal = /^http:\/\/(localhost|10\.0\.2\.2)/.test(serverUrl);

const config: CapacitorConfig = {
  appId: "app.gen.discovery",
  appName: "gen",
  // Required by Capacitor even when `server.url` takes over at runtime.
  webDir: "public",
  server: {
    url: serverUrl,
    cleartext: isLocal, // plain http only for local dev; production must be https
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#09090b",
  },
};

export default config;
