/**
 * data.ts — ccconv データ取得層
 * CLI表示ロジックから分離されたデータアクセス関数群
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ── 設定解決 ────────────────────────────────────────────────────────────

export function resolveConfigDirs(rawArgs: string[]): string[] {
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

export const configDirs = resolveConfigDirs(process.argv.slice(2));
export const projectsDirs = configDirs.map((d) => join(d, "projects"));
export const today = new Date().toISOString().split("T")[0];

// ── 型定義 ──────────────────────────────────────────────────────────────

export interface Entry {
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

export interface DataOptions {
  projectFilter?: string | null;
  sessionFilter?: string | null;
  subagents?: boolean;
}

export interface ProjectSummary {
  name: string;
  fileCount: number;
  lastUpdate: Date;
  totalMessages: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cwd: string;
  gitBranch: string;
  sessionStart: Date;
  sessionEnd: Date;
  subagentCount: number;
}

export interface SubagentInfo {
  agentId: string;
  model: string;
  msgCount: number;
  timestamp: string;
  firstMsg: string;
  sessionId: string;
  projectDir: string;
}

export interface SessionInfo {
  sessionId: string;
  messageCount: number;
  firstTimestamp: string;
  lastTimestamp: string;
  subagentCount: number;
}

export interface TokenStats {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  sessionCount: number;
}

// ── ユーティリティ ──────────────────────────────────────────────────────

export interface ProjectsGetOptions {
  sinceFilter?: string | null;
  projectFilter?: string | null;
  sortBy?: string | null;
}

// ── データ取得 ──────────────────────────────────────────────────────────

export function readJsonlFile(filePath: string, projectDir: string, fileName: string, extraFields: Partial<Entry> = {}): Entry[] {
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

export function getAllData(opts: DataOptions = {}): Entry[] {
  const { projectFilter = null, sessionFilter = null, subagents = false } = opts;
  const allData: Entry[] = [];
  const seenSessions = new Set<string>(); // 重複排除用

  for (const projectsDir of projectsDirs) {
    if (!existsSync(projectsDir)) continue;

    const projectDirEntries = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const projectDir of projectDirEntries) {
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

export function applySinceFilter(data: Entry[], sinceFilter: string | null): Entry[] {
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

export function getProjects(opts: ProjectsGetOptions = {}): ProjectSummary[] {
  const { sinceFilter = null, projectFilter = null, sortBy = null } = opts;

  const allProjectDirs: { name: string; path: string }[] = [];
  const seenProjects = new Set<string>();
  for (const projectsDir of projectsDirs) {
    if (!existsSync(projectsDir)) continue;
    for (const d of readdirSync(projectsDir, { withFileTypes: true })) {
      if (!d.isDirectory() || seenProjects.has(d.name)) continue;
      if (projectFilter && d.name !== projectFilter) continue;
      seenProjects.add(d.name);
      allProjectDirs.push({ name: d.name, path: join(projectsDir, d.name) });
    }
  }

  const summaries: ProjectSummary[] = [];

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

  return summaries;
}

export interface SubagentsGetOptions {
  sinceFilter?: string | null;
  projectFilter?: string | null;
  sessionFilter?: string | null;
}

export function getSubagents(opts: SubagentsGetOptions = {}): (SubagentInfo & { _sessionDir: string; _projectDir: string })[] {
  const { sinceFilter = null, projectFilter = null, sessionFilter = null } = opts;
  const results: (SubagentInfo & { _sessionDir: string; _projectDir: string })[] = [];
  const seenProjects = new Set<string>();

  for (const projectsDir of projectsDirs) {
    if (!existsSync(projectsDir)) continue;
    const projectDirEntries = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const projectDir of projectDirEntries) {
      if (projectFilter && !projectDir.includes(projectFilter)) continue;
      if (seenProjects.has(projectDir)) continue;
      seenProjects.add(projectDir);

      const fp = join(projectsDir, projectDir);
      const sessionDirs = readdirSync(fp, { withFileTypes: true })
        .filter((d) => d.isDirectory() && /^[0-9a-f]{8}-/.test(d.name));

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

          results.push({
            agentId,
            model,
            msgCount,
            timestamp,
            firstMsg,
            sessionId: sd.name,
            projectDir,
            _sessionDir: sd.name,
            _projectDir: projectDir,
          });
        }
      }
    }
  }

  return results;
}

export function getSessions(projectFilter: string | null): SessionInfo[] {
  const sessions: SessionInfo[] = [];
  const seenSessions = new Set<string>();

  for (const projectsDir of projectsDirs) {
    if (!existsSync(projectsDir)) continue;
    const projectDirEntries = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const projectDir of projectDirEntries) {
      if (projectFilter && projectDir !== projectFilter) continue;

      const fp = join(projectsDir, projectDir);
      try {
        const files = readdirSync(fp).filter((f) => f.endsWith(".jsonl"));
        for (const file of files) {
          const sessionId = file.replace(".jsonl", "");
          if (seenSessions.has(sessionId)) continue;
          seenSessions.add(sessionId);

          const filePath = join(fp, file);
          let messageCount = 0;
          let firstTimestamp = "";
          let lastTimestamp = "";
          let subagentCount = 0;

          try {
            const lines = readFileSync(filePath, "utf8").trim().split("\n");
            messageCount = lines.length;
            for (const line of lines) {
              try {
                const e = JSON.parse(line);
                if (e.timestamp) {
                  if (!firstTimestamp || e.timestamp < firstTimestamp) firstTimestamp = e.timestamp;
                  if (!lastTimestamp || e.timestamp > lastTimestamp) lastTimestamp = e.timestamp;
                }
              } catch {}
            }
          } catch {}

          const subagentsDir = join(fp, sessionId, "subagents");
          if (existsSync(subagentsDir)) {
            try {
              subagentCount = readdirSync(subagentsDir).filter((f) => f.endsWith(".jsonl")).length;
            } catch {}
          }

          sessions.push({ sessionId, messageCount, firstTimestamp, lastTimestamp, subagentCount });
        }
      } catch {}
    }
  }

  return sessions;
}

export function getTokenStats(): TokenStats {
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const data = getAllData();
  const recent = data.filter((e) => e.timestamp && new Date(e.timestamp) >= fourHoursAgo);

  let inputTokens = 0, outputTokens = 0, cacheCreationTokens = 0, cacheReadTokens = 0;
  for (const e of recent) {
    if (e.message?.usage) {
      inputTokens += e.message.usage.input_tokens || 0;
      outputTokens += e.message.usage.output_tokens || 0;
      cacheCreationTokens += e.message.usage.cache_creation_input_tokens || 0;
      cacheReadTokens += e.message.usage.cache_read_input_tokens || 0;
    }
  }

  return { inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, sessionCount: recent.length };
}
