import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.gen.discovery",
  appName: "Gen laptop",
  webDir: "out",
  server: {
    url: "https://gen-laptop-liart.vercel.app/",
    cleartext: true,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#09090b",
  },
};

export default config;