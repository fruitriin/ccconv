# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Claude Code log handling tool (`ccconv.js`) written in Node.js. It reads conversation logs stored in the Claude Code projects directory (`~/.claude/projects/`) and provides various ways to display and handle the data.

## Commands

This project has no package.json, so it runs directly with Node.js:

```bash
# Show today's log files and statistics
node ccconv.js

# Export all data as JSON
node ccconv.js raws

# Filter by specific columns
node ccconv.js raws --column=timestamp,type,message.content

# Filter by message type
node ccconv.js raws --type=user          # User messages only (excludes tool_result)
node ccconv.js raws --type=userandtools # User messages including tool_result
node ccconv.js raws --type=assistant    # Assistant messages + tool_result

# Show token usage for last 4 hours
node ccconv.js tokens
```

## Code Architecture

### Core Functions

- `getAllData()`: Recursively reads all `.jsonl` files from `~/.claude/projects/` and parses JSON entries
- `getNestedValue(obj, path)`: Safely accesses nested object properties with support for array indexing (e.g., `message.content[0].text`)
- `isToolResult(entry)`: Identifies tool execution results in conversation logs
- `extractArrayValues(array, propertyPath)`: Extracts values from arrays with property path support

### Data Structure

The tool processes Claude Code conversation logs with this structure:
- Each entry contains metadata: `sessionId`, `timestamp`, `cwd`, `gitBranch`, `type` (user/assistant)
- User messages: `{role: "user", content: "text"}`
- Assistant messages: Include `usage` token counts and `content` arrays with text/tool_use
- Tool results are stored as user-type entries with `tool_result` content

### Key Features

1. **Data Filtering**: Type-based filtering with special handling for tool results
2. **Column Extraction**: Support for nested property access including array notation (`content[].text`)
3. **Token Analytics**: Aggregates token usage from recent sessions
4. **File Discovery**: Automatically discovers and processes all project logs

The tool is designed to work with Claude Code's internal logging format and provides ways to handle conversation data, token usage, and tool interactions.

## Documentation

This project maintains dual-language documentation:

- `README.md` (Japanese): Primary documentation in Japanese
- `README.us.md` (English): English version of the documentation

**IMPORTANT**: When updating documentation, always maintain synchronization between both README files. Any changes to one file should be reflected in the other with appropriate translation to ensure both versions contain the same information and remain consistent.