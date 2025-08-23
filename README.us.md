# ccconv Claude Code Conversations

[README(日本語)](README.md) | [README(English)](README.us.md)

A command-line tool for handling Claude Code conversation logs

## Overview

This tool reads Claude Code conversation logs stored in `~/.claude/projects/` and provides various ways to display and handle the data.

## Installation

```bash
npm install --global ccconv
```

After global installation, you can use it as the `ccconv` command.

## Usage

### Basic Commands

```bash
# Show today's log files and statistics
node ccconv.js

# Export today's conversation data as JSON (default)
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

# Show today's updated projects (default)
node ccconv.js projects

# Show all projects with summary
node ccconv.js projects --since=all

# Show token usage for last 4 hours
node ccconv.js tokens
```

### Project Display Options

```bash
# Display in compact one-line format
node ccconv.js projects --one-line

# Sort by token count
node ccconv.js projects --sort=tokens

# Sort by message count
node ccconv.js projects --sort=messages

# Output in JSON format
node ccconv.js projects --json
```

### Data Filtering

```bash
# Filter by specific columns
node ccconv.js raws --column=timestamp,type,message.content

# Filter by specific project
node ccconv.js raws --project=ccconv

# Specify output format
node ccconv.js raws --format=talk     # Conversation style
node ccconv.js raws --format=plain    # Key: value format

# Filter by message type
node ccconv.js raws --type=user          # User messages only (excludes tool_result)
node ccconv.js raws --type=userandtools # User messages including tool_result
node ccconv.js raws --type=assistant    # Assistant messages + tool_result
```

## Features

### Data Display

- **Default**: Shows today's created/updated files with size, message count, and token usage
- **raws**: Outputs conversation data in JSON format (default: today's data only)
- **projects**: Shows project list and summary (default: today's updates only)
- **tokens**: Displays total token usage for the last 4 hours

### Date Filtering

- **--since=all**: Show data from all periods
- **--since=date**: Show data from specified date onwards (e.g., `--since=2024-08-20`)
- **Default**: Shows today's data only when no `--since` option is specified

### Project Display Formats

- **Standard format**: Detailed information displayed in multiple lines
- **--one-line**: Compact one-line format (💬message count ⏱️period 📅last update)
- **--json**: JSON format output
- **--sort=**: Specify sort order (tokens/messages/update)

### Other Features

- **Project Filter**: Use `--project=` to show data from specific project only
- **Output Formats**: `--format=talk` (conversation style), `--format=plain` (key: value format)
- **Column Filter**: Use `--column=` to specify which fields to display (combinable with `--format=plain`)
- **Type Filter**: Use `--type=` to filter by message type
- **Nested Access**: Supports deep property access like `message.content[0].text`

### Examples

```bash
# Show timestamp and token usage for assistant messages from specified date
node ccconv.js raws --since=2024-08-20 --column=timestamp,message.usage --type=assistant

# Show today's projects in one-line format sorted by token count
node ccconv.js projects --one-line --sort=tokens

# Show session ID and working directory for all user messages
node ccconv.js raws --since=all --column=sessionId,cwd --type=user
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
