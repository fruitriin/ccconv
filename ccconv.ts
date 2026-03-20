#!/usr/bin/env bun

/**
 * ccconv — Claude Code Conversations v0.1.0
 * Claude Code の会話ログをコマンドラインで扱うためのツール
 *
 * サブコマンド:
 *   (default) / talk  会話風の読みやすい形式で出力
 *   raws               JSON形式で出力
 *   projects           プロジェクト一覧
 *   tokens             直近4時間のトークン使用量
 *   files              今日のファイル一覧（旧デフォルト）
 */

import { readFileSync, readdirSync, statSync, existsSync, watchFile, unwatchFile, openSync, readSync, closeSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ── 設定解決 ────────────────────────────────────────────────────────────

function resolveConfigDirs(rawArgs: string[]): string[] {
  const dIdx = rawArgs.indexOf("-d");
  if (dIdx !== -1 && rawArgs[dIdx + 1]) return [rawArgs[dIdx + 1]];
  const dirArg = rawArgs.find((a) => a.startsWith("--dir="));
  if (dirArg) return [dirArg.split("--dir=")[1]];

  // ~/.claude と CLAUDE_CONFIG_DIR の両方を候補にする（重複排除）
  const dirs = new Set<string>();
  dirs.add(join(homedir(), ".claude"));
  if (process.env.CLAUDE_CONFIG_DIR) dirs.add(process.env.CLAUDE_CONFIG_DIR);
  // ~/.config/claude も候補に追加（Claude Code のバージョンによって異なる）
  const xdgConfig = join(homedir(), ".config", "claude");
  if (existsSync(join(xdgConfig, "projects"))) dirs.add(xdgConfig);
  return [...dirs];
}

const rawArgs = process.argv.slice(2);
const configDirs = resolveConfigDirs(rawArgs);
const projectsDirs = configDirs.map((d) => join(d, "projects"));
const today = new Date().toISOString().split("T")[0];

// グローバルオプション (-d / --dir=) を除外した引数
const args = rawArgs.filter((arg, i, arr) => {
  if (arg === "-d") return false;
  if (i > 0 && arr[i - 1] === "-d") return false;
  if (arg.startsWith("--dir=")) return false;
  return true;
});

// ── ユーティリティ ─────────────────────────────────────────────────────

interface Entry {
  parentUuid?: string;
  isSidechain?: boolean;
  userType?: string;
  cwd?: string;
  sessionId?: string;
  version?: string;
  gitBranch?: string;
  agentId?: string;
  type?: string;
  message?: any;
  uuid?: string;
  timestamp?: string;
  requestId?: string;
  _filePath?: string;
  _projectDir?: string;
  _fileName?: string;
  _isSubagent?: boolean;
  _parentSession?: string;
  _agentId?: string;
}

function parseArg(args: string[], name: string): string | null {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split(`--${name}=`)[1] : null;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

function inferProjectFromCwd(): string {
  // /Users/riin/workspace/riin-service → -Users-riin-workspace-riin-service
  return process.cwd().replace(/\//g, "-");
}

function isToolResult(entry: Entry): boolean {
  if (entry.message && Array.isArray(entry.message.content)) {
    return entry.message.content.some((item: any) => item.type === "tool_result");
  }
  if (entry.message?.content?.type === "tool_result") return true;
  return false;
}

function formatTimestamp(ts: string): { dateStr: string; timeStr: string } | null {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dateStr: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    timeStr: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
}

// ── データ取得 ─────────────────────────────────────────────────────────

interface DataOptions {
  projectFilter?: string | null;
  sessionFilter?: string | null;
  subagents?: boolean;
}

function readJsonlFile(filePath: string, projectDir: string, fileName: string, extraFields: Partial<Entry> = {}): Entry[] {
  const entries: Entry[] = [];
  try {
    const content = readFileSync(filePath, "utf8");
    for (const line of content.trim().split("\n")) {
      try {
        const entry: Entry = JSON.parse(line);
        entry._filePath = filePath;
        entry._projectDir = projectDir;
        entry._fileName = fileName;
        Object.assign(entry, extraFields);
        entries.push(entry);
      } catch {}
    }
  } catch {}
  return entries;
}

function getAllData(opts: DataOptions = {}): Entry[] {
  const { projectFilter = null, sessionFilter = null, subagents = false } = opts;
  const allData: Entry[] = [];
  const seenSessions = new Set<string>(); // 重複排除用

  for (const projectsDir of projectsDirs) {
    if (!existsSync(projectsDir)) continue;

    const projectDirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const projectDir of projectDirs) {
      if (projectFilter && projectDir !== projectFilter) continue;

      const fullProjectPath = join(projectsDir, projectDir);
      try {
        let files = readdirSync(fullProjectPath).filter((f) => f.endsWith(".jsonl"));

        if (sessionFilter) {
          files = files.filter((f) => f.replace(".jsonl", "").startsWith(sessionFilter));
        }

        for (const file of files) {
          // 同じセッションIDが複数のconfigDirに存在する場合は最初のものだけ読む
          if (seenSessions.has(file)) continue;
          seenSessions.add(file);

          const filePath = join(fullProjectPath, file);
          allData.push(...readJsonlFile(filePath, projectDir, file));

          // サブエージェントを読む
          if (subagents) {
            const sessionId = file.replace(".jsonl", "");
            const subagentsDir = join(fullProjectPath, sessionId, "subagents");
            if (existsSync(subagentsDir)) {
              try {
                const agentFiles = readdirSync(subagentsDir).filter((f) => f.endsWith(".jsonl"));
                for (const agentFile of agentFiles) {
                  const agentId = agentFile.replace(".jsonl", "").replace(/^agent-/, "");
                  const agentFilePath = join(subagentsDir, agentFile);
                  allData.push(...readJsonlFile(agentFilePath, projectDir, agentFile, {
                    _isSubagent: true,
                    _parentSession: sessionId,
                    _agentId: agentId,
                  }));
                }
              } catch {}
            }
          }
        }
      } catch {}
    }
  }

  return allData;
}

function applySinceFilter(data: Entry[], sinceFilter: string | null): Entry[] {
  if (sinceFilter === "all") return data;
  let sinceDate: Date;
  if (sinceFilter === null) {
    sinceDate = new Date(today);
  } else {
    sinceDate = new Date(sinceFilter);
    if (isNaN(sinceDate.getTime())) {
      console.log(`⚠️ 無効な日付形式: ${sinceFilter}`);
      return [];
    }
  }
  return data.filter((e) => {
    if (!e.timestamp) return false;
    return new Date(e.timestamp) >= sinceDate;
  });
}

function sortByTimestamp(data: Entry[], reverse: boolean): Entry[] {
  return data.sort((a, b) => {
    const ta = new Date(a.timestamp || 0).getTime();
    const tb = new Date(b.timestamp || 0).getTime();
    return reverse ? tb - ta : ta - tb;
  });
}

// ── Talk 形式出力 ──────────────────────────────────────────────────────

interface TalkOptions {
  thinking?: boolean;
  tools?: boolean;
  toolsMeta?: boolean;
}

function showSingleTalkEntry(entry: Entry, opts: TalkOptions = {}, linePrefix: string = ""): void {
  if (!entry.timestamp) return;
  const fmt = formatTimestamp(entry.timestamp);
  if (!fmt) return;
  const { dateStr, timeStr } = fmt;
  const prefix = `${linePrefix}[${dateStr} ${timeStr}]`;

  if (entry.type === "assistant" && entry.message?.content && Array.isArray(entry.message.content)) {
    // thinking
    if (opts.thinking) {
      for (const block of entry.message.content) {
        if (block.type === "thinking" && block.thinking) {
          console.log(`${prefix} Thinking:`);
          console.log(block.thinking.split("\n").map((l: string) => `${linePrefix}${l}`).join("\n"));
          console.log("");
        }
      }
    }

    // tool_use (meta)
    if (opts.toolsMeta) {
      for (const block of entry.message.content) {
        if (block.type === "tool_use") {
          const keys = Object.keys(block.input || {});
          console.log(`${prefix} Tool: ${block.name}(${keys.join(", ")})`);
          console.log("");
        }
      }
    } else if (opts.tools) {
      for (const block of entry.message.content) {
        if (block.type === "tool_use") {
          console.log(`${prefix} Tool Use: ${block.name}`);
          try { console.log(JSON.stringify(block.input, null, 2).split("\n").map((l: string) => `${linePrefix}${l}`).join("\n")); } catch {}
          console.log("");
        }
      }
    }

    // text
    const text = entry.message.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n")
      .trim();
    if (text) {
      console.log(`${prefix} Assistant:`);
      console.log(text.split("\n").map((l: string) => `${linePrefix}${l}`).join("\n"));
      console.log("");
    }
  } else if (entry.type === "user" && !isToolResult(entry)) {
    // user message
    let content = "";
    if (typeof entry.message?.content === "string") {
      content = entry.message.content;
    } else if (Array.isArray(entry.message?.content)) {
      content = entry.message.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n");
    }
    if (content.trim()) {
      console.log(`${prefix} User:`);
      console.log(content.trim().split("\n").map((l: string) => `${linePrefix}${l}`).join("\n"));
      console.log("");
    }
  } else if (entry.type === "user" && isToolResult(entry)) {
    // tool result — only show with --tools (not --tools=meta)
    if (!opts.tools) return;
    let toolName = "Tool";
    let toolContent = "";
    const contents = Array.isArray(entry.message?.content)
      ? entry.message.content
      : [entry.message?.content].filter(Boolean);
    const result = contents.find((c: any) => c.type === "tool_result");
    if (result) {
      toolName = result.name || "Tool";
      if (typeof result.content === "string") {
        toolContent = result.content;
      } else if (Array.isArray(result.content)) {
        toolContent = result.content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("\n");
      }
    }
    if (toolContent.trim()) {
      console.log(`${prefix} Tool Result: ${toolName}`);
      const lines = toolContent.trim().split("\n");
      if (lines.length > 5) {
        console.log(lines.slice(0, 3).map((l: string) => `${linePrefix}${l}`).join("\n"));
        console.log(`${linePrefix}... (${lines.length - 3} more lines)`);
      } else {
        console.log(lines.map((l: string) => `${linePrefix}${l}`).join("\n"));
      }
      console.log("");
    }
  }
}

// ── Watch モード ───────────────────────────────────────────────────────

function getTargetFiles(projectFilter: string | null, sessionFilter: string | null): string[] {
  const files: string[] = [];
  const seen = new Set<string>();

  for (const projectsDir of projectsDirs) {
    if (!existsSync(projectsDir)) continue;
    const projectDirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const pd of projectDirs) {
      if (projectFilter && pd !== projectFilter) continue;
      const fp = join(projectsDir, pd);
      let jsonls = readdirSync(fp).filter((f) => f.endsWith(".jsonl"));
      if (sessionFilter) {
        jsonls = jsonls.filter((f) => f.replace(".jsonl", "").startsWith(sessionFilter));
      }
      for (const f of jsonls) {
        if (seen.has(f)) continue;
        seen.add(f);
        files.push(join(fp, f));
      }
    }
  }
  return files;
}

function watchTalk(targetFiles: string[], opts: TalkOptions & { sessionFilter?: string | null }): void {
  if (targetFiles.length === 0) {
    console.error("監視対象のファイルが見つかりません");
    process.exit(1);
  }

  const positions: Record<string, number> = {};
  for (const f of targetFiles) {
    try {
      positions[f] = statSync(f).size;
    } catch {
      positions[f] = 0;
    }
  }

  console.error(`Watching ${targetFiles.length} file(s)... (Ctrl+C to stop)`);

  for (const filePath of targetFiles) {
    watchFile(filePath, { interval: 500 }, (curr) => {
      if (curr.size <= (positions[filePath] || 0)) return;
      try {
        const fd = openSync(filePath, "r");
        const bufSize = curr.size - positions[filePath];
        const buf = Buffer.alloc(bufSize);
        readSync(fd, buf, 0, bufSize, positions[filePath]);
        closeSync(fd);

        for (const line of buf.toString("utf8").split("\n")) {
          if (!line.trim()) continue;
          try {
            const entry: Entry = JSON.parse(line);
            if (opts.sessionFilter && !entry.sessionId?.startsWith(opts.sessionFilter)) return;
            showSingleTalkEntry(entry, opts);
          } catch {}
        }
        positions[filePath] = curr.size;
      } catch {}
    });
  }

  process.on("SIGINT", () => {
    for (const f of targetFiles) unwatchFile(f);
    process.exit(0);
  });
}

// ── talk サブコマンド ──────────────────────────────────────────────────

function cmdTalk(cmdArgs: string[]): void {
  const sinceFilter = parseArg(cmdArgs, "since");
  const sessionFilter = parseArg(cmdArgs, "session");
  const reverse = hasFlag(cmdArgs, "reverse");
  const thinking = hasFlag(cmdArgs, "thinking");
  const watch = hasFlag(cmdArgs, "watch");
  const showSubagents = hasFlag(cmdArgs, "subagents");

  const toolsArg = cmdArgs.find((a) => a === "--tools" || a.startsWith("--tools="));
  const tools = toolsArg === "--tools";
  const toolsMeta = toolsArg === "--tools=meta";

  // プロジェクト: 明示指定 > cwd推定
  let projectFilter = parseArg(cmdArgs, "project");
  if (!projectFilter) {
    const inferred = inferProjectFromCwd();
    for (const projectsDir of projectsDirs) {
      if (!existsSync(projectsDir)) continue;
      const dirs = readdirSync(projectsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
      if (dirs.includes(inferred)) { projectFilter = inferred; break; }
    }
  }

  const talkOpts: TalkOptions = { thinking, tools, toolsMeta };

  if (watch) {
    const files = getTargetFiles(projectFilter, sessionFilter);
    watchTalk(files, { ...talkOpts, sessionFilter });
    return;
  }

  let data = getAllData({ projectFilter, sessionFilter, subagents: showSubagents });
  data = applySinceFilter(data, sinceFilter);
  sortByTimestamp(data, reverse);

  if (!showSubagents) {
    for (const entry of data) {
      showSingleTalkEntry(entry, talkOpts);
    }
    return;
  }

  // サブエージェントあり: 親エントリとサブエージェントエントリを分けて、
  // 親セッションの会話の後にそのサブエージェントを表示する
  const parentEntries = data.filter((e) => !e._isSubagent);
  const subagentEntries = data.filter((e) => e._isSubagent);

  // 親エントリを表示し、セッション境界でサブエージェントを差し込む
  const seenSessionsForSub = new Set<string>();
  for (const entry of parentEntries) {
    showSingleTalkEntry(entry, talkOpts);

    // このエントリの sessionId に紐づくサブエージェントがあれば、セッション末尾で表示
    const sid = entry.sessionId;
    if (sid && !seenSessionsForSub.has(sid)) {
      // 同じセッションの次エントリが別セッションかチェック
      const idx = parentEntries.indexOf(entry);
      const nextEntry = parentEntries[idx + 1];
      if (!nextEntry || nextEntry.sessionId !== sid) {
        // このセッションの全サブエージェントを表示
        const sessionSubs = subagentEntries.filter((e) => e._parentSession === sid);
        const subAgentIds = [...new Set(sessionSubs.map((e) => e._agentId))];
        for (const agentId of subAgentIds) {
          const agentEntries = sessionSubs.filter((e) => e._agentId === agentId);
          // モデル名を取得（assistantエントリのmessage.modelから）
          const modelEntry = agentEntries.find((e) => e.type === "assistant" && e.message?.model);
          const modelName = modelEntry?.message?.model || "";
          const headerModel = modelName ? ` (${modelName})` : "";
          console.log(`  ┏━ subagent: ${agentId}${headerModel}`);
          for (const subEntry of agentEntries) {
            showSingleTalkEntry(subEntry, talkOpts, "  ┃ ");
          }
          console.log(`  ┗━ end subagent`);
          console.log("");
        }
        seenSessionsForSub.add(sid);
      }
    }
  }
}

// ── raws サブコマンド ─────────────────────────────────────────────────

function getNestedValue(obj: any, path: string): any {
  if (path.includes("[") && path.includes("]")) {
    const parts = path.split(".");
    let current = obj;
    for (const part of parts) {
      if (part.includes("[") && part.includes("]")) {
        const [prop, bracket] = part.split("[");
        const accessor = bracket.slice(0, -1);
        if (current && current[prop]) {
          current = accessor === "" ? current[prop] : current[prop][parseInt(accessor)];
        } else {
          return undefined;
        }
      } else {
        current = current?.[part];
      }
    }
    return current;
  }
  return path.split(".").reduce((c, k) => c?.[k], obj);
}

function cmdRaws(cmdArgs: string[]): void {
  const columnArg = parseArg(cmdArgs, "column") || cmdArgs.find((a) => a.startsWith("column="))?.split("column=")[1] || null;
  const typeFilter = parseArg(cmdArgs, "type") || cmdArgs.find((a) => a.startsWith("type="))?.split("type=")[1] || null;
  const sinceFilter = parseArg(cmdArgs, "since");
  const projectFilter = parseArg(cmdArgs, "project");
  const sessionFilter = parseArg(cmdArgs, "session");
  const formatType = parseArg(cmdArgs, "format");
  const reverse = hasFlag(cmdArgs, "reverse");

  let data = getAllData({ projectFilter, sessionFilter });
  data = applySinceFilter(data, sinceFilter);

  // type filter
  if (typeFilter) {
    if (typeFilter === "user") {
      data = data.filter((e) => e.type === "user" && !isToolResult(e));
    } else if (typeFilter === "userandtools") {
      data = data.filter((e) => e.type === "user");
    } else if (typeFilter === "assistant") {
      data = data.filter((e) => e.type === "assistant" || (e.type === "user" && isToolResult(e)));
    } else {
      data = data.filter((e) => e.type === typeFilter);
    }
  }

  sortByTimestamp(data, reverse);

  if (formatType === "talk") {
    for (const entry of data) showSingleTalkEntry(entry);
    return;
  }

  if (formatType === "plain") {
    showPlainFormat(data, columnArg);
    return;
  }

  // JSON output
  if (columnArg) {
    const cols = columnArg.split(",").map((c) => c.trim());
    const filtered = data.map((entry) => {
      const result: Record<string, any> = {};
      for (const col of cols) {
        result[col] = getNestedValue(entry, col);
      }
      return result;
    });
    console.log(JSON.stringify(filtered, null, 2));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

function showPlainFormat(data: Entry[], columnFilter: string | null): void {
  data.forEach((entry, index) => {
    if (columnFilter) {
      for (const col of columnFilter.split(",")) {
        const trimmed = col.trim();
        const value = getNestedValue(entry, trimmed);
        const display = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
        console.log(`${trimmed}: ${display}`);
      }
    } else {
      for (const [key, value] of Object.entries(entry)) {
        if (key.startsWith("_")) continue;
        const display = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
        console.log(`${key}: ${display}`);
      }
    }
    if (index < data.length - 1) console.log("");
  });
}

// ── projects サブコマンド ─────────────────────────────────────────────

function cmdProjects(cmdArgs: string[]): void {
  const sinceFilter = parseArg(cmdArgs, "since");
  const jsonOutput = hasFlag(cmdArgs, "json");
  const oneLineOutput = hasFlag(cmdArgs, "one-line");
  const sortBy = parseArg(cmdArgs, "sort");

  // 全configDirからプロジェクトを収集
  const allProjectDirs: { name: string; path: string }[] = [];
  const seenProjects = new Set<string>();
  for (const projectsDir of projectsDirs) {
    if (!existsSync(projectsDir)) continue;
    for (const d of readdirSync(projectsDir, { withFileTypes: true })) {
      if (!d.isDirectory() || seenProjects.has(d.name)) continue;
      seenProjects.add(d.name);
      allProjectDirs.push({ name: d.name, path: join(projectsDir, d.name) });
    }
  }

  if (allProjectDirs.length === 0) {
    console.log("projects ディレクトリが見つかりません");
    return;
  }

  const summaries: any[] = [];

  for (const { name: projectDir, path: fp } of allProjectDirs) {
    try {
      const files = readdirSync(fp).filter((f) => f.endsWith(".jsonl"));
      if (files.length === 0) continue;

      let totalMessages = 0, totalInput = 0, totalOutput = 0;
      let latestUpdate = new Date(0), earliestSession = new Date();
      let latestCwd = "", latestBranch = "";
      let subagentCount = 0;

      for (const file of files) {
        const filePath = join(fp, file);
        const stats = statSync(filePath);

        if (sinceFilter !== "all") {
          const sinceDate = sinceFilter ? new Date(sinceFilter) : new Date(today);
          if (isNaN(sinceDate.getTime())) continue;
          const fileDate = new Date(stats.mtime.toISOString().split("T")[0]);
          if (fileDate < sinceDate) continue;
        }

        if (stats.mtime > latestUpdate) latestUpdate = stats.mtime;

        try {
          const lines = readFileSync(filePath, "utf8").trim().split("\n");
          totalMessages += lines.length;
          for (const line of lines) {
            try {
              const e = JSON.parse(line);
              const d = new Date(e.timestamp);
              if (d < earliestSession) earliestSession = d;
              if (e.cwd) latestCwd = e.cwd;
              if (e.gitBranch) latestBranch = e.gitBranch;
              if (e.message?.usage) {
                totalInput += e.message.usage.input_tokens || 0;
                totalOutput += e.message.usage.output_tokens || 0;
              }
            } catch {}
          }
        } catch {}

        // サブエージェント数をカウント
        const sessionId = file.replace(".jsonl", "");
        const subagentsDir = join(fp, sessionId, "subagents");
        if (existsSync(subagentsDir)) {
          try {
            const agentFiles = readdirSync(subagentsDir).filter((f) => f.endsWith(".jsonl"));
            subagentCount += agentFiles.length;
          } catch {}
        }
      }

      if (totalMessages > 0) {
        summaries.push({
          name: projectDir,
          fileCount: files.length,
          lastUpdate: latestUpdate,
          totalMessages,
          inputTokens: totalInput,
          outputTokens: totalOutput,
          totalTokens: totalInput + totalOutput,
          cwd: latestCwd,
          gitBranch: latestBranch,
          sessionStart: earliestSession,
          sessionEnd: latestUpdate,
          subagentCount,
        });
      }
    } catch {}
  }

  // sort
  if (sortBy === "tokens") summaries.sort((a, b) => b.totalTokens - a.totalTokens);
  else if (sortBy === "messages") summaries.sort((a, b) => b.totalMessages - a.totalMessages);
  else if (sortBy === "update") summaries.sort((a, b) => +b.lastUpdate - +a.lastUpdate);
  else summaries.sort((a, b) => a.name.localeCompare(b.name));

  if (jsonOutput) { console.log(JSON.stringify(summaries, null, 2)); return; }
  if (summaries.length === 0) { console.log("プロジェクトが見つかりません"); return; }

  if (oneLineOutput) {
    for (const s of summaries) {
      const shortName = s.name.split("-").pop() || s.name;
      const startISO = s.sessionStart.toISOString();
      const endISO = s.sessionEnd.toISOString();
      const startDate = startISO.split("T")[0].replace(/-/g, "/");
      const endDate = endISO.split("T")[0].replace(/-/g, "/");
      const startTime = startISO.split("T")[1].substring(0, 5);
      const endTime = endISO.split("T")[1].substring(0, 5);
      const period = startDate === endDate
        ? `${startDate} ${startTime}~${endTime}`
        : `${startDate} ${startTime}~${endDate} ${endTime}`;
      const lastDate = s.lastUpdate.toISOString().split("T")[0].replace(/-/g, "/");
      const lastTime = s.lastUpdate.toISOString().split("T")[1].substring(0, 5);
      const subagentPart = s.subagentCount > 0 ? ` 🤖${s.subagentCount}` : "";
      console.log(`${shortName} 💬${s.totalMessages.toLocaleString()} ⏱️${period} 📅${lastDate} ${lastTime}${subagentPart}`);
    }
    return;
  }

  console.log("プロジェクト一覧:\n");
  let totalAll = 0, totalMsgs = 0, totalToks = 0;
  for (const s of summaries) {
    totalAll++;
    totalMsgs += s.totalMessages;
    totalToks += s.totalTokens;
    console.log(`📁 ${s.name}`);
    console.log(`   📊 ファイル数: ${s.fileCount}個`);
    console.log(`   📅 最新更新: ${s.lastUpdate.toLocaleString("ja-JP")}`);
    console.log(`   💬 総メッセージ数: ${s.totalMessages.toLocaleString()}件`);
    console.log(`   🎯 総トークン: 入力=${s.inputTokens.toLocaleString()}, 出力=${s.outputTokens.toLocaleString()}`);
    if (s.subagentCount > 0) console.log(`   🤖 サブエージェント: ${s.subagentCount}回`);
    if (s.cwd) console.log(`   📂 作業ディレクトリ: ${s.cwd}`);
    if (s.gitBranch) console.log(`   🌿 Gitブランチ: ${s.gitBranch}`);
    const sd = s.sessionStart.toISOString().split("T")[0];
    const ed = s.sessionEnd.toISOString().split("T")[0];
    console.log(`   ⏱️  セッション期間: ${sd === ed ? sd : `${sd} ~ ${ed}`}`);
    console.log("");
  }
  console.log(`合計: ${totalAll}プロジェクト, ${totalMsgs.toLocaleString()}メッセージ, ${totalToks.toLocaleString()}トークン`);
}

// ── subagents サブコマンド ────────────────────────────────────────────

function cmdSubagents(rawArgs: string[]): void {
  let sinceFilter: string | null = null;
  let projectFilter: string | null = null;
  let sessionFilter: string | null = null;

  for (const a of rawArgs) {
    if (a.startsWith("--since=")) sinceFilter = a.split("=")[1];
    else if (a.startsWith("--project=")) projectFilter = a.split("=")[1];
    else if (a.startsWith("--session=")) sessionFilter = a.split("=")[1];
  }

  const seenProjects = new Set<string>();

  for (const projectsDir of projectsDirs) {
    if (!existsSync(projectsDir)) continue;
    const projectDirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const projectDir of projectDirs) {
      if (projectFilter && !projectDir.includes(projectFilter)) continue;
      if (seenProjects.has(projectDir)) continue;
      seenProjects.add(projectDir);

      const fp = join(projectsDir, projectDir);
      const sessionDirs = readdirSync(fp, { withFileTypes: true })
        .filter((d) => d.isDirectory() && /^[0-9a-f]{8}-/.test(d.name));

      let projectHasAgents = false;

      for (const sd of sessionDirs) {
        if (sessionFilter && !sd.name.startsWith(sessionFilter)) continue;

        const subagentsDir = join(fp, sd.name, "subagents");
        if (!existsSync(subagentsDir)) continue;

        const agentFiles = readdirSync(subagentsDir).filter((f) => f.endsWith(".jsonl"));
        if (agentFiles.length === 0) continue;

        // sinceFilter チェック
        if (sinceFilter && sinceFilter !== "all") {
          const sinceDate = new Date(sinceFilter);
          const sessionJsonl = join(fp, sd.name + ".jsonl");
          if (existsSync(sessionJsonl)) {
            const stats = statSync(sessionJsonl);
            if (new Date(stats.mtime.toISOString().split("T")[0]) < sinceDate) continue;
          }
        } else if (!sinceFilter) {
          // デフォルト: 今日のみ
          const sessionJsonl = join(fp, sd.name + ".jsonl");
          if (existsSync(sessionJsonl)) {
            const stats = statSync(sessionJsonl);
            if (stats.mtime.toISOString().split("T")[0] !== today) continue;
          }
        }

        if (!projectHasAgents) {
          console.log(`📁 ${projectDir}`);
          projectHasAgents = true;
        }

        console.log(`  📋 session: ${sd.name.substring(0, 8)}...`);

        for (const af of agentFiles) {
          const agentId = af.replace("agent-", "").replace(".jsonl", "");
          const metaPath = join(subagentsDir, af.replace(".jsonl", ".meta.json"));

          let model = "";
          let firstMsg = "";
          let msgCount = 0;
          let timestamp = "";

          // meta.json からモデル名取得
          if (existsSync(metaPath)) {
            try {
              const meta = JSON.parse(readFileSync(metaPath, "utf8"));
              model = meta.model || "";
            } catch {}
          }

          // JSONL から最初のユーザーメッセージとメッセージ数を取得
          try {
            const lines = readFileSync(join(subagentsDir, af), "utf8").trim().split("\n");
            msgCount = lines.length;
            for (const line of lines) {
              try {
                const e = JSON.parse(line);
                if (!timestamp && e.timestamp) timestamp = e.timestamp;
                if (!firstMsg && e.type === "user" && e.message?.content) {
                  const content = typeof e.message.content === "string"
                    ? e.message.content
                    : Array.isArray(e.message.content)
                      ? e.message.content.map((c: any) => c.text || "").join("")
                      : "";
                  firstMsg = content.replace(/\n/g, " ").substring(0, 80);
                  if (content.length > 80) firstMsg += "...";
                }
              } catch {}
            }
          } catch {}

          const modelTag = model ? ` (${model.replace("claude-", "")})` : "";
          const time = timestamp ? timestamp.split("T")[1]?.substring(0, 5) || "" : "";
          console.log(`    🤖 ${agentId.substring(0, 12)}${modelTag} 💬${msgCount} ${time}`);
          if (firstMsg) console.log(`       ${firstMsg}`);
        }
      }

      if (projectHasAgents) console.log("");
    }
  }
}

// ── tokens サブコマンド ───────────────────────────────────────────────

function cmdTokens(): void {
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const data = getAllData();
  const recent = data.filter((e) => e.timestamp && new Date(e.timestamp) >= fourHoursAgo);

  let inp = 0, out = 0, cacheCreate = 0, cacheRead = 0;
  for (const e of recent) {
    if (e.message?.usage) {
      inp += e.message.usage.input_tokens || 0;
      out += e.message.usage.output_tokens || 0;
      cacheCreate += e.message.usage.cache_creation_input_tokens || 0;
      cacheRead += e.message.usage.cache_read_input_tokens || 0;
    }
  }

  console.log(`直近4時間のトークン使用量:`);
  console.log(`  入力トークン: ${inp.toLocaleString()}`);
  console.log(`  出力トークン: ${out.toLocaleString()}`);
  console.log(`  キャッシュ作成: ${cacheCreate.toLocaleString()}`);
  console.log(`  キャッシュ読み取り: ${cacheRead.toLocaleString()}`);
  console.log(`  セッション数: ${recent.length}`);
}

// ── files サブコマンド（旧デフォルト） ────────────────────────────────

function cmdFiles(): void {
  console.log(`今日 (${today}) のファイル一覧:\n`);
  let found = false;

  for (const projectsDir of projectsDirs) {
    if (!existsSync(projectsDir)) continue;
    const projectDirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const pd of projectDirs) {
      const fp = join(projectsDir, pd);
    try {
      const files = readdirSync(fp).filter((f) => f.endsWith(".jsonl"));
      for (const file of files) {
        const filePath = join(fp, file);
        const stats = statSync(filePath);
        if (stats.mtime.toISOString().split("T")[0] !== today) continue;
        found = true;
        console.log(`📁 ${pd}`);
        console.log(`   📄 ${file}`);
        console.log(`   📊 サイズ: ${(stats.size / 1024).toFixed(1)}KB`);
        console.log(`   🕐 更新: ${stats.mtime.toLocaleString("ja-JP")}`);

        try {
          const lines = readFileSync(filePath, "utf8").trim().split("\n");
          let inp = 0, out = 0;
          for (const l of lines) {
            try {
              const e = JSON.parse(l);
              if (e.message?.usage) {
                inp += e.message.usage.input_tokens || 0;
                out += e.message.usage.output_tokens || 0;
              }
            } catch {}
          }
          if (inp > 0 || out > 0) console.log(`   🎯 トークン: 入力=${inp.toLocaleString()}, 出力=${out.toLocaleString()}`);
          console.log(`   💬 メッセージ数: ${lines.length}`);
        } catch {}
        console.log("");
      }
    } catch {}
    }
  }

  if (!found) console.log("今日作成/更新されたファイルはありません");
}

// ── Usage ─────────────────────────────────────────────────────────────

function showUsage(): void {
  console.log(`ccconv — Claude Code Conversations

使い方:
  ccconv                               今日の会話をtalk形式で表示（デフォルト）
  ccconv talk                          同上
  ccconv talk --session=<id>           セッションIDで絞り込み
  ccconv talk --watch                  ファイル監視（新しい行を即座に出力）
  ccconv talk --watch --session=<id>   特定セッションだけwatch
  ccconv talk --thinking               thinkingブロックも表示
  ccconv talk --tools                  ツール呼び出し全部表示
  ccconv talk --tools=meta             ツール名+入力キーだけ表示
  ccconv talk --since=all              全期間
  ccconv talk --reverse                逆順
  ccconv talk --subagents              サブエージェントの会話も表示

  ccconv raws                          今日のデータをJSONで出力
  ccconv raws --since=all              全データ
  ccconv raws --project=<name>         プロジェクト指定
  ccconv raws --session=<id>           セッション指定
  ccconv raws --format=talk            会話風形式
  ccconv raws --format=plain           key: value形式
  ccconv raws --column=timestamp,type  列指定
  ccconv raws --type=user              タイプフィルタ
  ccconv raws --reverse                逆順

  ccconv projects                      今日更新のプロジェクト（サブエージェント統計含む）
  ccconv projects --since=all          全プロジェクト
  ccconv projects --json               JSON出力
  ccconv projects --one-line           1行形式
  ccconv projects --sort=tokens        ソート

  ccconv subagents                     今日のサブエージェント一覧
  ccconv subagents --since=all         全期間
  ccconv subagents --project=<name>    プロジェクト指定
  ccconv subagents --session=<id>      セッション指定

  ccconv tokens                        直近4時間のトークン使用量
  ccconv files                         今日のファイル一覧（旧デフォルト）

グローバルオプション:
  -d <path> / --dir=<path>  Claudeの設定ディレクトリを指定`);
}

// ── メイン ─────────────────────────────────────────────────────────────

const cmd = args[0];

if (!cmd || cmd === "talk") {
  cmdTalk(cmd ? args.slice(1) : []);
} else if (cmd === "raws") {
  cmdRaws(args.slice(1));
} else if (cmd === "projects") {
  cmdProjects(args.slice(1));
} else if (cmd === "subagents") {
  cmdSubagents(args.slice(1));
} else if (cmd === "tokens") {
  cmdTokens();
} else if (cmd === "files") {
  cmdFiles();
} else {
  showUsage();
}
