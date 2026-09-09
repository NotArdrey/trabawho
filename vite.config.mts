import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const registrationLogEndpoint = "/__trabawho_registration_log";
const maxLogBytes = 64 * 1024;

function registrationLogMiddleware(
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) {
  if (request.method !== "POST" || request.url !== registrationLogEndpoint) {
    next();
    return;
  }

  let rawBody = "";
  request.setEncoding("utf8");
  request.on("data", (chunk: string) => {
    rawBody = `${rawBody}${chunk}`.slice(0, maxLogBytes);
  });
  request.on("end", () => {
    try {
      const body = JSON.parse(rawBody) as {
        eventName?: string;
        level?: "error" | "warn" | "log";
        payload?: unknown;
      };
      const method = body.level === "error" || body.level === "warn" ? body.level : "log";
      console[method](`[TrabaWho Registration Terminal] ${body.eventName ?? "unknown_event"}`, body.payload ?? {});
    } catch {
      console.warn("[TrabaWho Registration Terminal] Invalid log payload");
    }
    response.statusCode = 204;
    response.end();
  });
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "trabawho-registration-log",
      configureServer(server) {
        server.middlewares.use(registrationLogMiddleware);
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  envPrefix: ["VITE_", "REACT_APP_"],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.PORT ?? 3000),
  },
  preview: {
    host: "127.0.0.1",
    port: Number(process.env.PORT ?? 3000),
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    exclude: ["tests/e2e/**", "scripts/**", "node_modules/**"],
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|react-router)/ },
            { name: "supabase", test: /node_modules[\\/](@supabase|@isaacs|iceberg-js)/ },
            { name: "ui", test: /node_modules[\\/](@radix-ui|lucide-react|sonner)/ },
            { name: "feature-work", test: /src[\\/]features[\\/]work[\\/]/ },
            { name: "feature-bookings", test: /src[\\/]features[\\/]bookings[\\/]/ },
            { name: "feature-auth", test: /src[\\/]features[\\/]auth[\\/]/ },
            { name: "feature-marketplace", test: /src[\\/]features[\\/]marketplace[\\/]/ },
            { name: "feature-admin", test: /src[\\/]features[\\/]admin[\\/]/ },
            { name: "feature-profile", test: /src[\\/]features[\\/]profile[\\/]/ },
            { name: "feature-landing", test: /src[\\/]features[\\/]landing[\\/]/ },
          ],
        },
      },
    },
  },
});
