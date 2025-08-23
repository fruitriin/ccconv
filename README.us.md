# cchistory

[README(日本語)](README.md) | [README(English)](README.us.md)

A command-line tool for analyzing Claude Code conversation logs

## Overview

This tool reads Claude Code conversation logs stored in `~/.claude/projects/` and provides various data views and analysis capabilities.

## Installation

```bash
npm install --global cchistory
```

After global installation, you can use it as the `cchistory` command.

## Usage

```bash
# Show today's log files and statistics
node cchistory.js

# Export all data as JSON
node cchistory.js raws

# Filter by specific columns
node cchistory.js raws --column=timestamp,type,message.content

# Filter by message type
node cchistory.js raws --type=user          # User messages only (excludes tool_result)
node cchistory.js raws --type=userandtools # User messages including tool_result
node cchistory.js raws --type=assistant    # Assistant messages + tool_result

# Show token usage for last 4 hours
node cchistory.js tokens
```

## Features

### Data Display
- **Default**: Shows today's created/updated files with size, message count, and token usage
- **raws**: Outputs all conversation data in JSON format
- **tokens**: Displays total token usage for the last 4 hours

### Filtering Capabilities
- **Column Filter**: Use `--column=` to specify which fields to display
- **Type Filter**: Use `--type=` to filter by message type
- **Nested Access**: Supports deep property access like `message.content[0].text`

### Examples

```bash
# Show only timestamp and token usage for assistant messages
node cchistory.js raws --column=timestamp,message.usage --type=assistant

# Show only session ID and working directory for user messages
node cchistory.js raws --column=sessionId,cwd --type=user
```

## Data Structure

Claude Code log data follows this structure:

```javascript
{
  "parentUuid": "UUID of previous message (null for first)",
  "isSidechain": false,
  "userType": "external",
  "cwd": "/working/directory",
  "sessionId": "Session ID",
  "version": "Claude Code version",
  "gitBranch": "Git branch name",
  "type": "user" | "assistant",
  "message": { /* Message content */ },
  "uuid": "UUID of this message",
  "timestamp": "ISO8601 timestamp"
}
```

## Requirements

- Node.js
- Claude Code installed (log files must exist in `~/.claude/projects/`)

## License

MIT