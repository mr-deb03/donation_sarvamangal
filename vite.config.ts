import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";

import { mockApi } from "./mock/mock-api";

/**
 * Easebuzz can send the donor back to its return address
 * (APP_PORTAL_BASE_DOMAIN/app/paymentdetails/receipt/:donationId/:orderId) with a form POST,
 * which the dev server would answer with a 404. Turn it into a GET of the receipt page —
 * what api/easebuzz-return.js does on Vercel.
 */
function easebuzzReturn(): Plugin {
  const handle: Connect.NextHandleFunction = (req, res, next) => {
    const match = req.method === "POST" ? req.url?.match(/^\/app\/paymentdetails\/receipt\/(\d{1,12})\/[^/?#]+\/?(?:\?|$)/) : null;
    if (!match) return next();
    res.statusCode = 303;
    res.setHeader("Location", `/receipt/${match[1]}`);
    res.end();
  };
  return {
    name: "easebuzz-return",
    configureServer: (server) => void server.middlewares.use(handle),
    configurePreviewServer: (server) => void server.middlewares.use(handle),
  };
}

export default defineConfig(({ mode }) => ({
  // `npm run dev:mock` serves a fake API at /mock-api (see mock/mock-api.ts and .env.mock).
  plugins: [react(), tailwindcss(), easebuzzReturn(), mode === "mock" ? mockApi() : null],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5173 },
  build: {
    // jsPDF is only loaded when a donor downloads the acknowledgement.
    chunkSizeWarningLimit: 600,
  },
}));
