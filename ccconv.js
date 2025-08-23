#!/usr/bin/env node

/**
 * 
 * ccconv command
 * 
 * 
 * (no option) 使い方を表示する
 * 
 * サブコマンド
 * raws   そのままのデータをjsonで出力する
 *   --column=表示するカラムを絞り込む
 *   --type=[user|assistant] ユーザー/アシスタントの出力のみ
 * tokens 直近4時間のセッションを抜き出してトークンを合計する
 * 
 * TODO
 * projects  プロジェクトのサマリを一覧する
 * raws --prject=指定のプロジェクトのみ
 * 
 * 
 * データ構造
 {
"parentUuid": "前のメッセージのUUID (最初はnull)",
"isSidechain": false,
"userType": "external",
"cwd": "/作業ディレクトリ",
"sessionId": "セッションID",
"version": "Claude Codeのバージョン",
"gitBranch": "Gitブランチ名",
"type": "user" | "assistant",
"message": { メッセージ内容  },
"uuid": "このメッセージのUUID",
"timestamp": "ISO8601形式のタイムスタンプ"
}

ユーザーのメッセージ
"message": {
"role": "user",
"content": "メッセージテキスト"
}

アシスタントメッセージ
"message": {
"id": "AnthropicのメッセージID",
"type": "message",
"role": "assistant",
"model": "claude-sonnet-4-20250514",
"content": [ テキストやツール使用 ],
"stop_reason": null,
"stop_sequence": null,
"usage": {
"input_tokens": 4,
"cache_creation_input_tokens": 14785,
"cache_read_input_tokens": 0,
"output_tokens": 26,
"service_tier": "standard"
}
},
"requestId": "AnthropicのリクエストID"


 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const projectsDir = path.join(os.homedir(), '.claude', 'projects');

// 今日の日付を取得 (YYYY-MM-DD形式)
const today = new Date().toISOString().split('T')[0];

function getAllData() {
  const allData = [];
  
  if (!fs.existsSync(projectsDir)) {
    return allData;
  }

  const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  projectDirs.forEach(projectDir => {
    const fullProjectPath = path.join(projectsDir, projectDir);
    
    try {
      const files = fs.readdirSync(fullProjectPath)
        .filter(file => file.endsWith('.jsonl'));

      files.forEach(file => {
        const filePath = path.join(fullProjectPath, file);
        
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.trim().split('\n');
          
          lines.forEach(line => {
            try {
              const entry = JSON.parse(line);
              entry._filePath = filePath;
              entry._projectDir = projectDir;
              entry._fileName = file;
              allData.push(entry);
            } catch (e) {
              // JSON解析エラーは無視
            }
          });
        } catch (e) {
          // ファイル読み取りエラーは無視
        }
      });
    } catch (e) {
      // ディレクトリ読み取りエラーは無視
    }
  });

  return allData;
}

function getNestedValue(obj, path) {
  // 配列アクセス記法 [] を処理
  if (path.includes('[') && path.includes(']')) {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (part.includes('[') && part.includes(']')) {
        // 配列アクセス記法を解析
        const [prop, bracket] = part.split('[');
        const arrayAccessor = bracket.slice(0, -1); // ] を除去
        
        if (current && current[prop]) {
          if (arrayAccessor === '') {
            // [] → 全要素を展開
            current = current[prop];
          } else {
            // 数値インデックス
            const index = parseInt(arrayAccessor);
            current = current[prop] && current[prop][index];
          }
        } else {
          return undefined;
        }
      } else {
        current = current && current[part] !== undefined ? current[part] : undefined;
      }
    }
    
    return current;
  }
  
  // 従来の処理
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

function isToolResult(entry) {
  // message.content が配列かつ tool_result を含むかチェック
  if (entry.message && Array.isArray(entry.message.content)) {
    return entry.message.content.some(item => item.type === 'tool_result');
  }
  // message.content が単体オブジェクトで tool_result の場合
  if (entry.message && entry.message.content && entry.message.content.type === 'tool_result') {
    return true;
  }
  return false;
}

function extractArrayValues(array, propertyPath) {
  if (!Array.isArray(array)) return undefined;
  
  return array.map(item => {
    if (propertyPath) {
      return getNestedValue(item, propertyPath);
    }
    return item;
  }).filter(value => value !== undefined);
}

function showRaws(columnFilter, typeFilter, sinceFilter) {
  let data = getAllData();
  
  // sinceフィルタの適用
  if (sinceFilter !== 'all') {
    let sinceDate;
    if (sinceFilter === null) {
      // --sinceオプションがない場合はデフォルトで今日
      sinceDate = new Date(today);
    } else {
      // --since=指定値をパース
      sinceDate = new Date(sinceFilter);
      if (isNaN(sinceDate.getTime())) {
        console.log(`⚠️ 無効な日付形式: ${sinceFilter}`);
        return;
      }
    }
    
    data = data.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate >= sinceDate;
    });
  }
  
  // typeフィルタを適用
  if (typeFilter) {
    if (typeFilter === 'user') {
      // type=user かつ tool_result を除外
      data = data.filter(entry => entry.type === 'user' && !isToolResult(entry));
    } else if (typeFilter === 'userandtools') {
      // type=user（tool_result含む）
      data = data.filter(entry => entry.type === 'user');
    } else if (typeFilter === 'assistant') {
      // type=assistant または (type=user かつ tool_result)
      data = data.filter(entry => 
        entry.type === 'assistant' || 
        (entry.type === 'user' && isToolResult(entry))
      );
    } else {
      // その他の場合は通常のフィルタ
      data = data.filter(entry => entry.type === typeFilter);
    }
  }
  
  if (columnFilter) {
    const filtered = data.map(entry => {
      const result = {};
      columnFilter.split(',').forEach(col => {
        const trimmedCol = col.trim();
        
        // 配列展開記法 message.content[].text の処理
        if (trimmedCol.includes('[].')) {
          const [arrayPath, propertyPath] = trimmedCol.split('[].');
          const arrayValue = getNestedValue(entry, arrayPath);
          result[trimmedCol] = extractArrayValues(arrayValue, propertyPath);
        } else {
          result[trimmedCol] = getNestedValue(entry, trimmedCol);
        }
      });
      return result;
    });
    console.log(JSON.stringify(filtered, null, 2));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

function showTokens() {
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const data = getAllData();
  
  const recentData = data.filter(entry => {
    const timestamp = new Date(entry.timestamp);
    return timestamp >= fourHoursAgo;
  });

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheCreationTokens = 0;
  let totalCacheReadTokens = 0;

  recentData.forEach(entry => {
    if (entry.message && entry.message.usage) {
      totalInputTokens += entry.message.usage.input_tokens || 0;
      totalOutputTokens += entry.message.usage.output_tokens || 0;
      totalCacheCreationTokens += entry.message.usage.cache_creation_input_tokens || 0;
      totalCacheReadTokens += entry.message.usage.cache_read_input_tokens || 0;
    }
  });

  console.log(`直近4時間のトークン使用量:`);
  console.log(`  入力トークン: ${totalInputTokens.toLocaleString()}`);
  console.log(`  出力トークン: ${totalOutputTokens.toLocaleString()}`);
  console.log(`  キャッシュ作成: ${totalCacheCreationTokens.toLocaleString()}`);
  console.log(`  キャッシュ読み取り: ${totalCacheReadTokens.toLocaleString()}`);
  console.log(`  セッション数: ${recentData.length}`);
}

function getTodaysFiles() {
  if (!fs.existsSync(projectsDir)) {
    console.log('projects ディレクトリが見つかりません');
    return;
  }

  const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  console.log(`今日 (${today}) のファイル一覧:\n`);

  let foundFiles = false;

  projectDirs.forEach(projectDir => {
    const fullProjectPath = path.join(projectsDir, projectDir);
    
    try {
      const files = fs.readdirSync(fullProjectPath)
        .filter(file => file.endsWith('.jsonl'));

      files.forEach(file => {
        const filePath = path.join(fullProjectPath, file);
        const stats = fs.statSync(filePath);
        const fileDate = stats.mtime.toISOString().split('T')[0];
        
        if (fileDate === today) {
          foundFiles = true;
          const fileSize = (stats.size / 1024).toFixed(1);
          const lastModified = stats.mtime.toLocaleString('ja-JP');
          
          console.log(`📁 ${projectDir}`);
          console.log(`   📄 ${file}`);
          console.log(`   📊 サイズ: ${fileSize}KB`);
          console.log(`   🕐 更新: ${lastModified}`);
          
          // ファイル内容から最新のトークン使用量を取得
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.trim().split('\n');
            let totalInputTokens = 0;
            let totalOutputTokens = 0;
            
            lines.forEach(line => {
              try {
                const entry = JSON.parse(line);
                if (entry.message && entry.message.usage) {
                  totalInputTokens += entry.message.usage.input_tokens || 0;
                  totalOutputTokens += entry.message.usage.output_tokens || 0;
                }
              } catch (e) {
                // JSON解析エラーは無視
              }
            });
            
            if (totalInputTokens > 0 || totalOutputTokens > 0) {
              console.log(`   🎯 トークン: 入力=${totalInputTokens.toLocaleString()}, 出力=${totalOutputTokens.toLocaleString()}`);
            }
            
            console.log(`   💬 メッセージ数: ${lines.length}`);
          } catch (e) {
            console.log(`   ⚠️  ファイル読み取りエラー: ${e.message}`);
          }
          
          console.log('');
        }
      });
    } catch (e) {
      console.log(`⚠️ ディレクトリ読み取りエラー (${projectDir}): ${e.message}`);
    }
  });

  if (!foundFiles) {
    console.log('今日作成/更新されたファイルはありません');
  }
}

function showProjects(sinceFilter, jsonOutput, sortBy, oneLineOutput) {
  if (!fs.existsSync(projectsDir)) {
    console.log('projects ディレクトリが見つかりません');
    return;
  }

  const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  const projectSummaries = [];

  projectDirs.forEach(projectDir => {
    const fullProjectPath = path.join(projectsDir, projectDir);
    
    try {
      const files = fs.readdirSync(fullProjectPath)
        .filter(file => file.endsWith('.jsonl'));

      if (files.length === 0) return;

      let totalMessages = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let latestUpdate = new Date(0);
      let earliestSession = new Date();
      let latestCwd = '';
      let latestBranch = '';

      files.forEach(file => {
        const filePath = path.join(fullProjectPath, file);
        const stats = fs.statSync(filePath);
        
        // sinceフィルタが有効な場合の処理
        if (sinceFilter !== 'all') {
          let sinceDate;
          if (sinceFilter === null) {
            // --sinceオプションがない場合はデフォルトで今日
            sinceDate = new Date(today);
          } else {
            // --since=指定値をパース
            sinceDate = new Date(sinceFilter);
            if (isNaN(sinceDate.getTime())) {
              console.log(`⚠️ 無効な日付形式: ${sinceFilter}`);
              return;
            }
          }
          
          const fileDate = new Date(stats.mtime.toISOString().split('T')[0]);
          if (fileDate < sinceDate) return;
        }

        if (stats.mtime > latestUpdate) {
          latestUpdate = stats.mtime;
        }

        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.trim().split('\n');
          totalMessages += lines.length;

          lines.forEach(line => {
            try {
              const entry = JSON.parse(line);
              const entryDate = new Date(entry.timestamp);
              
              if (entryDate < earliestSession) {
                earliestSession = entryDate;
              }

              if (entry.cwd) latestCwd = entry.cwd;
              if (entry.gitBranch) latestBranch = entry.gitBranch;

              if (entry.message && entry.message.usage) {
                totalInputTokens += entry.message.usage.input_tokens || 0;
                totalOutputTokens += entry.message.usage.output_tokens || 0;
              }
            } catch (e) {
              // JSON解析エラーは無視
            }
          });
        } catch (e) {
          // ファイル読み取りエラーは無視
        }
      });

      if (totalMessages > 0) {
        const summary = {
          name: projectDir,
          fileCount: files.length,
          lastUpdate: latestUpdate,
          totalMessages,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
          cwd: latestCwd,
          gitBranch: latestBranch,
          sessionStart: earliestSession,
          sessionEnd: latestUpdate
        };
        
        projectSummaries.push(summary);
      }
    } catch (e) {
      console.log(`⚠️ ディレクトリ読み取りエラー (${projectDir}): ${e.message}`);
    }
  });

  // ソート処理
  if (sortBy === 'tokens') {
    projectSummaries.sort((a, b) => b.totalTokens - a.totalTokens);
  } else if (sortBy === 'messages') {
    projectSummaries.sort((a, b) => b.totalMessages - a.totalMessages);
  } else if (sortBy === 'update') {
    projectSummaries.sort((a, b) => b.lastUpdate - a.lastUpdate);
  } else {
    // デフォルトは名前順
    projectSummaries.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (jsonOutput) {
    console.log(JSON.stringify(projectSummaries, null, 2));
    return;
  }

  // テキスト形式での出力
  if (projectSummaries.length === 0) {
    console.log('プロジェクトが見つかりません');
    return;
  }

  if (oneLineOutput) {
    // ワンライン形式での出力
    projectSummaries.forEach(summary => {
      // プロジェクト名を短縮（最後の部分のみ表示）
      const shortName = summary.name.split('-').pop() || summary.name;
      
      // セッション期間（日付と時刻）
      const startDateTime = summary.sessionStart.toISOString();
      const endDateTime = summary.sessionEnd.toISOString();
      const startDateFormatted = startDateTime.split('T')[0].replace(/-/g, '/') + ' ' + startDateTime.split('T')[1].substring(0, 5);
      const endDateFormatted = endDateTime.split('T')[0].replace(/-/g, '/') + ' ' + endDateTime.split('T')[1].substring(0, 5);
      
      const startDateOnly = startDateTime.split('T')[0].replace(/-/g, '/');
      const endDateOnly = endDateTime.split('T')[0].replace(/-/g, '/');
      
      let period;
      if (startDateOnly === endDateOnly) {
        // 同じ日の場合は時刻の範囲のみ表示
        const startTime = startDateTime.split('T')[1].substring(0, 5);
        const endTime = endDateTime.split('T')[1].substring(0, 5);
        period = `${startDateOnly} ${startTime}~${endTime}`;
      } else {
        // 異なる日の場合は日付と時刻を両方表示
        period = `${startDateFormatted}~${endDateFormatted}`;
      }
      
      // 最終更新日時
      const lastUpdateDateTime = summary.lastUpdate.toISOString();
      const lastUpdateDate = lastUpdateDateTime.split('T')[0].replace(/-/g, '/');
      const lastUpdateTime = lastUpdateDateTime.split('T')[1].substring(0, 5); // HH:mm
      
      console.log(`${shortName} 💬${summary.totalMessages.toLocaleString()} ⏱️${period} 📅${lastUpdateDate} ${lastUpdateTime}`);
    });
    return;
  }

  console.log('プロジェクト一覧:\n');

  let totalProjects = 0;
  let totalAllMessages = 0;
  let totalAllTokens = 0;

  projectSummaries.forEach(summary => {
    totalProjects++;
    totalAllMessages += summary.totalMessages;
    totalAllTokens += summary.totalTokens;

    console.log(`📁 ${summary.name}`);
    console.log(`   📊 ファイル数: ${summary.fileCount}個`);
    console.log(`   📅 最新更新: ${summary.lastUpdate.toLocaleString('ja-JP')}`);
    console.log(`   💬 総メッセージ数: ${summary.totalMessages.toLocaleString()}件`);
    console.log(`   🎯 総トークン: 入力=${summary.inputTokens.toLocaleString()}, 出力=${summary.outputTokens.toLocaleString()}`);
    
    if (summary.cwd) {
      console.log(`   📂 作業ディレクトリ: ${summary.cwd}`);
    }
    if (summary.gitBranch) {
      console.log(`   🌿 Gitブランチ: ${summary.gitBranch}`);
    }
    
    const startDate = summary.sessionStart.toISOString().split('T')[0];
    const endDate = summary.sessionEnd.toISOString().split('T')[0];
    if (startDate === endDate) {
      console.log(`   ⏱️  セッション期間: ${startDate}`);
    } else {
      console.log(`   ⏱️  セッション期間: ${startDate} ~ ${endDate}`);
    }
    
    console.log('');
  });

  console.log(`合計: ${totalProjects}プロジェクト, ${totalAllMessages.toLocaleString()}メッセージ, ${totalAllTokens.toLocaleString()}トークン`);
}

function showUsage() {
  console.log(`Claude Code ログ解析ツール

使い方:
  node ccconv.js                   今日のファイル一覧を表示
  node ccconv.js raws              今日のデータをJSONで出力（デフォルト）
  node ccconv.js raws --since=all  全データをJSONで出力
  node ccconv.js raws --since=2024-08-20  指定日以降のデータをJSONで出力
  node ccconv.js raws --column=timestamp,type  指定した列のみを出力
  node ccconv.js raws --type=user  ユーザーメッセージのみ（tool_result除外）
  node ccconv.js raws --type=userandtools  ユーザーメッセージ（tool_result含む）
  node ccconv.js raws --type=assistant  アシスタントメッセージ＋tool_result
  node ccconv.js projects          今日更新されたプロジェクトを表示（デフォルト）
  node ccconv.js projects --since=all  全プロジェクトの一覧とサマリを表示
  node ccconv.js projects --since=2024-08-20  指定日以降更新のプロジェクトを表示
  node ccconv.js projects --json   プロジェクト一覧をJSON形式で出力
  node ccconv.js projects --one-line  コンパクトな1行形式で表示
  node ccconv.js projects --sort=tokens  トークン数順でソート（tokens/messages/update）
  node ccconv.js tokens            直近4時間のトークン使用量を表示

例:
  node ccconv.js raws --since=2024-08-20 --column=timestamp,message.usage --type=assistant
  node ccconv.js raws --since=all --column=sessionId,cwd --type=user
  node ccconv.js projects --since=2024-08-20 --sort=tokens
  node ccconv.js projects --one-line --sort=messages`);
}

// コマンドライン引数の解析
const args = process.argv.slice(2);

if (args.length === 0) {
  getTodaysFiles();
} else if (args[0] === 'raws') {
  // column= または --column= の両方に対応
  const columnArg = args.find(arg => arg.startsWith('column=') || arg.startsWith('--column='));
  let columns = null;
  if (columnArg) {
    columns = columnArg.includes('--column=') ? columnArg.split('--column=')[1] : columnArg.split('column=')[1];
  }
  
  // type= または --type= の両方に対応
  const typeArg = args.find(arg => arg.startsWith('type=') || arg.startsWith('--type='));
  let typeFilter = null;
  if (typeArg) {
    typeFilter = typeArg.includes('--type=') ? typeArg.split('--type=')[1] : typeArg.split('type=')[1];
  }
  
  // --since= オプションのチェック
  const sinceArg = args.find(arg => arg.startsWith('--since='));
  let sinceFilter = null;
  if (sinceArg) {
    sinceFilter = sinceArg.split('--since=')[1];
  }
  
  showRaws(columns, typeFilter, sinceFilter);
} else if (args[0] === 'projects') {
  // --since= オプションのチェック
  const sinceArg = args.find(arg => arg.startsWith('--since='));
  let sinceFilter = null;
  if (sinceArg) {
    sinceFilter = sinceArg.split('--since=')[1];
  }
  
  // --json フラグのチェック
  const jsonOutput = args.includes('--json');
  
  // --one-line フラグのチェック
  const oneLineOutput = args.includes('--one-line');
  
  // --sort= オプションのチェック
  const sortArg = args.find(arg => arg.startsWith('--sort='));
  let sortBy = null;
  if (sortArg) {
    sortBy = sortArg.split('--sort=')[1];
  }
  
  showProjects(sinceFilter, jsonOutput, sortBy, oneLineOutput);
} else if (args[0] === 'tokens') {
  showTokens();
} else {
  showUsage();
}