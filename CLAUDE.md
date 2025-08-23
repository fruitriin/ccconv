# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Claude Code log handling tool (`ccconv.js`) written in Node.js. It reads conversation logs stored in the Claude Code projects directory (`~/.claude/projects/`) and provides various ways to display and handle the data.

## Commands

This project has no package.json, so it runs directly with Node.js:

```bash
# Show today's log files and statistics
node ccconv.js

# Export today's conversation data as JSON (default behavior)
node ccconv.js raws

# Export all conversation data as JSON
node ccconv.js raws --since=all

# Export data from specified date onwards
node ccconv.js raws --since=2024-08-20

# Export data from specific project only
node ccconv.js raws --project=ccconv

# Export in conversation-style readable format
node ccconv.js raws --format=talk

# Export in simple key: value format
node ccconv.js raws --format=plain

# Show messages in reverse order (newest first)
node ccconv.js raws --reverse

# Show today's updated projects (default behavior)
node ccconv.js projects

# Show all projects with summary
node ccconv.js projects --since=all

# Display projects in compact one-line format
node ccconv.js projects --one-line

# Sort projects by various criteria
node ccconv.js projects --sort=tokens    # Sort by token count
node ccconv.js projects --sort=messages  # Sort by message count
node ccconv.js projects --sort=update    # Sort by last update time

# Output projects in JSON format
node ccconv.js projects --json

# Filter raw data by specific columns
node ccconv.js raws --column=timestamp,type,message.content

# Filter by specific project
node ccconv.js raws --project=ccconv

# Specify output format
node ccconv.js raws --format=talk     # Conversation style
node ccconv.js raws --format=plain    # Key: value format

# Control display order
node ccconv.js raws --reverse         # Show newest messages first

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
- `showRaws(columnFilter, typeFilter, sinceFilter, projectFilter, formatType, reverse)`: Outputs raw conversation data with flexible filtering, multiple output formats, and configurable sort order
- `showProjects(sinceFilter, jsonOutput, sortBy, oneLineOutput)`: Displays project summaries with various formatting options
- `getTodaysFiles()`: Shows today's log files with statistics
- `showTokens()`: Aggregates and displays token usage from recent sessions

### Data Structure

The tool processes Claude Code conversation logs with this structure:

- Each entry contains metadata: `sessionId`, `timestamp`, `cwd`, `gitBranch`, `type` (user/assistant)
- User messages: `{role: "user", content: "text"}`
- Assistant messages: Include `usage` token counts and `content` arrays with text/tool_use
- Tool results are stored as user-type entries with `tool_result` content

### Key Features

1. **Date Filtering**: Flexible `--since` option supporting specific dates or `all` for no filtering (defaults to today)
2. **Project Analysis**: Comprehensive project summaries with file counts, message statistics, and token usage
3. **Multiple Display Formats**: 
   - Standard detailed view
   - Compact one-line format with emoji decorations (💬 ⏱️ 📅)
   - JSON output for programmatic use
4. **Output Formats**: 
   - `--format=talk`: Conversation-style readable output with timestamps
   - `--format=plain`: Simple key: value format output
   - Default JSON format for programmatic use
5. **Display Order Control**: `--reverse` option to show newest messages first (reverse chronological order)
6. **Data Filtering**: Type-based filtering with special handling for tool results
7. **Column Extraction**: Support for nested property access including array notation (`content[].text`)
8. **Sorting Options**: Projects can be sorted by tokens, messages, or update time
9. **Token Analytics**: Aggregates token usage from recent sessions
10. **File Discovery**: Automatically discovers and processes all project logs

The tool is designed to work with Claude Code's internal logging format and provides comprehensive ways to analyze conversation patterns, project activity, token usage, and tool interactions.

## Documentation

This project maintains dual-language documentation:

- `README.md` (Japanese): Primary documentation in Japanese
- `README.us.md` (English): English version of the documentation

**IMPORTANT**: When updating documentation, always maintain synchronization between both README files. Any changes to one file should be reflected in the other with appropriate translation to ensure both versions contain the same information and remain consistent.
