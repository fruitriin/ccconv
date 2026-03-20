/**
 * server.ts — ccconv REST API サーバー
 * Bun.serve() を使ったシンプルな HTTP サーバー
 */

import { existsSync } from "fs";
import { join } from "path";
import {
  getAllData,
  getProjects,
  getSubagents,
  getSessions,
  getTokenStats,
  applySinceFilter,
} from "./data";

const port = parseInt(process.env.CCCONV_PORT || "13100", 10);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

async function serveStaticFile(pathname: string): Promise<Response> {
  const webDistDir = join(import.meta.dir, "..", "web", "dist");

  if (!existsSync(webDistDir)) {
    return new Response(
      "開発モード: web/dist/ が存在しません。`bun run build` でフロントエンドをビルドしてください。\n" +
        "API は http://localhost:" +
        port +
        "/api/* で利用可能です。",
      {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }
    );
  }

  // `/` → `index.html`
  const filePath =
    pathname === "/" ? join(webDistDir, "index.html") : join(webDistDir, pathname.slice(1));

  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    // SPA フォールバック: index.html を返す
    const indexFile = Bun.file(join(webDistDir, "index.html"));
    if (await indexFile.exists()) {
      return new Response(indexFile);
    }
    return new Response("Not Found", { status: 404 });
  }

  return new Response(file);
}

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const params = url.searchParams;

    // CORS プリフライト
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // GET のみ受け付ける
    if (req.method !== "GET") {
      return errorResponse("Method Not Allowed", 405);
    }

    // ── API エンドポイント ──────────────────────────────────────────

    if (path === "/api/projects") {
      const sinceFilter = params.get("since");
      const sortBy = params.get("sort");
      const projectFilter = params.get("project");

      const summaries = getProjects({ sinceFilter, sortBy, projectFilter });
      return jsonResponse(summaries);
    }

    if (path === "/api/sessions") {
      const project = params.get("project");
      if (!project) {
        return errorResponse("query parameter 'project' is required");
      }

      const sessions = getSessions(project);
      return jsonResponse(sessions);
    }

    if (path === "/api/conversations") {
      const projectFilter = params.get("project");
      const sessionFilter = params.get("session");
      const sinceFilter = params.get("since");
      const typeFilter = params.get("type") || "all";
      const includeSubagents = params.get("subagents") === "true";

      let data = getAllData({
        projectFilter,
        sessionFilter,
        subagents: includeSubagents,
      });

      data = applySinceFilter(data, sinceFilter);

      // typeフィルタ
      if (typeFilter === "user") {
        data = data.filter(
          (e) =>
            e.type === "user" &&
            !(
              e.message &&
              Array.isArray(e.message.content) &&
              e.message.content.some((item: any) => item.type === "tool_result")
            )
        );
      } else if (typeFilter === "assistant") {
        data = data.filter((e) => e.type === "assistant");
      }
      // "all" はフィルタなし

      return jsonResponse(data);
    }

    if (path === "/api/subagents") {
      const projectFilter = params.get("project");
      const sessionFilter = params.get("session");
      const sinceFilter = params.get("since");

      const agents = getSubagents({ projectFilter, sessionFilter, sinceFilter });
      return jsonResponse(agents);
    }

    if (path === "/api/tokens") {
      const stats = getTokenStats();
      return jsonResponse(stats);
    }

    // ── 静的ファイル配信 ───────────────────────────────────────────

    return serveStaticFile(path);
  },
});

console.log(`ccconv web server running on http://localhost:${port}`);
