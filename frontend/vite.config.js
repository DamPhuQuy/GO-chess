import { defineConfig } from "vite";

const backendOrigin = process.env.BACKEND_ORIGIN || "http://127.0.0.1:8080";

function docsJSONProxy() {
  return {
    name: "docs-json-proxy",
    configureServer(viteServer) {
      viteServer.middlewares.use((request, response, next) => {
        const requestURL = new URL(request.url || "/", backendOrigin);
        const acceptsGuideJSON = (request.headers.accept || "").includes("application/json");
        if (request.method !== "GET" || requestURL.pathname !== "/docs" || !acceptsGuideJSON) {
          next();
          return;
        }

        void fetch(`${backendOrigin}${requestURL.pathname}${requestURL.search}`, {
          headers: { Accept: "application/json" },
        })
          .then(async (upstreamResponse) => {
            response.statusCode = upstreamResponse.status;
            response.setHeader("Content-Type", upstreamResponse.headers.get("content-type") || "application/json; charset=utf-8");
            response.setHeader("Cache-Control", upstreamResponse.headers.get("cache-control") || "no-store");
            response.end(await upstreamResponse.text());
          })
          .catch((error) => {
            console.error("Could not fetch the guide from the backend:", error);
            response.statusCode = 502;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify({ error: "Không thể kết nối tới máy chủ hướng dẫn." }));
          });
      });
    },
  };
}

export default defineConfig({
  plugins: [docsJSONProxy()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": backendOrigin,
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
