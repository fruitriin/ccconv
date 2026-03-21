# ccconv Claude Code Conversations

[README(日本語)](README.md) | [README(English)](README.us.md)

A command-line tool for handling Claude Code conversation logs

![ccconv talk](docs/screenshots/ccconv-talk.png)

![ccconv web](docs/screenshots/ccconv-web.png)

## Overview

This tool reads Claude Code conversation logs stored in `~/.claude/projects/` and provides various ways to display and handle the data.

## Installation

```bash
# npm
npm install --global ccconv

# Or run directly with npx
npx ccconv

# Bun users
bunx ccconv
```

After global installation, you can use it as the `ccconv` command.

## Usage

### Basic Commands

```bash
ccconv                    # Show today's conversations in talk format (default)
ccconv talk --watch       # Real-time monitoring — also useful as a recall engine to feed another agent's conversation context
ccconv web                # Web dashboard (REST API + Vue.js frontend)
ccconv raws               # Export today's conversation data as JSON
ccconv projects           # List today's updated projects
ccconv subagents          # List subagents
ccconv tokens             # Token usage for last 4 hours
```

### talk Options

```bash
ccconv talk --session=<id>          # Filter by session
ccconv talk --watch --session=<id>  # Watch a specific session
ccconv talk --thinking              # Include thinking blocks
ccconv talk --tools                 # Show tool calls
ccconv talk --subagents             # Include subagent conversations
ccconv talk --since=all             # All time
ccconv talk --reverse               # Reverse order
```

### raws Options

```bash
ccconv raws --since=all                    # All conversation data
ccconv raws --since=2024-08-20             # From specified date
ccconv raws --project=ccconv               # Filter by project
ccconv raws --format=talk                  # Conversation style
ccconv raws --format=plain                 # Key: value format
ccconv raws --reverse                      # Reverse order
ccconv raws --type=user                    # User messages only (excludes tool_result)
ccconv raws --type=userandtools            # User messages including tool_result
ccconv raws --type=assistant               # Assistant messages + tool_result
ccconv raws --column=timestamp,type        # Column filter
```

### projects Options

```bash
ccconv projects --since=all        # All projects
ccconv projects --one-line         # Compact one-line format
ccconv projects --sort=tokens      # Sort by token count
ccconv projects --sort=messages    # Sort by message count
ccconv projects --json             # JSON output
```

### subagents Options

```bash
ccconv subagents --project=<name>  # Filter by project
ccconv subagents --session=<id>    # Filter by session
ccconv subagents --since=all       # All time
```

## Features

### Data Display

- **talk**: Human-readable conversation format (default). Use `--watch` for real-time monitoring
- **web**: REST API server + Vue.js dashboard with timeline sync, pane mode, and flow mode
- **subagents**: List and statistics of subagents
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
- **Display Order**: Use `--reverse` to show newest messages first (reverse chronological order)
- **Column Filter**: Use `--column=` to specify which fields to display (combinable with `--format=plain`)
- **Type Filter**: Use `--type=` to filter by message type
- **Nested Access**: Supports deep property access like `message.content[0].text`

### Examples

```bash
# Show timestamp and token usage for assistant messages from specified date
ccconv raws --since=2024-08-20 --column=timestamp,message.usage --type=assistant

# Show today's projects in one-line format sorted by token count
ccconv projects --one-line --sort=tokens

# Show session ID and working directory for all user messages
ccconv raws --since=all --column=sessionId,cwd --type=user

# Show latest conversations first in talk format
ccconv raws --format=talk --reverse
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

- Bun
- Claude Code installed (log files must exist in `~/.claude/projects/`)

## License

MIT
