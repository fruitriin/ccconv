# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2025-08-23

### Added
- `--format=talk` option for conversation-style readable output with timestamps
- `--format=plain` option for simple key: value format output
- `--reverse` option for reverse chronological display (newest messages first)
- Enhanced timezone handling to display times in local timezone instead of UTC
- Comprehensive usage examples in all documentation files

### Changed
- Improved time display formatting with local timezone consideration
- Updated all documentation (README.md, README.us.md, CLAUDE.md) with new format options
- Enhanced function signatures to support new formatting and sorting options

### Fixed
- Fixed timezone display issue where times were shown in UTC instead of local time
- Improved error handling for invalid timestamps in format functions

## [0.0.1] - 2025-08-23

### Added
- Initial release of ccconv (Claude Code Conversations tool)
- Basic command-line interface for analyzing Claude Code conversation logs
- `projects` command to display project summaries with statistics
- `raws` command to export conversation data in JSON format
- `tokens` command to show token usage for recent sessions
- `--since` option to filter data by date (replaces `--today`)
- `--project` option to filter data by specific project
- `--column` option to specify which fields to display
- `--type` option to filter by message type (user/assistant/userandtools)
- Support for nested property access and array notation
- Multiple display formats for projects (standard, one-line, JSON)
- Sorting options for projects (by tokens, messages, update time)
- Dual-language documentation (Japanese and English)
- Comprehensive error handling and validation

### Features
- Automatic discovery and processing of all Claude Code project logs
- Flexible date filtering with support for specific dates or all data
- Type-based message filtering with special handling for tool results
- Token usage analytics and aggregation
- File statistics and project activity tracking
- Support for complex data structures and nested object access