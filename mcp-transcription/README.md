# MCP Audio Transcription Server

An MCP (Model Context Protocol) server that provides audio transcription capabilities to AI assistants like Claude. This server uses OpenAI's Whisper API to transcribe audio and video files.

## Features

- 🎯 Transcribe local audio/video files
- 🌐 Transcribe files from URLs
- 📦 Automatic chunking for large files (>25MB)
- 🌍 Multi-language support with auto-detection
- 📄 Multiple output formats (txt, srt, json)
- 🎵 Supports various audio/video formats (mp3, m4a, wav, mkv, mp4, etc.)

## Installation

1. Clone the repository and navigate to the MCP server directory:
```bash
cd mcp-transcription
```

2. Install dependencies:
```bash
npm install
```

3. Build the server:
```bash
npm run build
```

## Configuration

### Environment Variables

Set your OpenAI API key:
```bash
export OPENAI_API_KEY=your-api-key-here
```

### Claude Desktop Configuration

Add the server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "audio-transcription": {
      "command": "node",
      "args": ["/path/to/mcp-transcription/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools

### 1. transcribe_file

Transcribes a local audio or video file.

**Parameters:**
- `path` (required): Path to the audio/video file
- `language` (optional): Language code (e.g., 'en', 'ru', 'es') or 'auto' for automatic detection
- `format` (optional): Output format - 'txt', 'srt', or 'json' (default: 'txt')

**Example:**
```
Please transcribe the file at /Users/me/audio.mp3
```

### 2. transcribe_url

Downloads and transcribes an audio or video file from a URL.

**Parameters:**
- `url` (required): URL of the audio/video file
- `language` (optional): Language code or 'auto' for automatic detection
- `format` (optional): Output format - 'txt', 'srt', or 'json' (default: 'txt')

**Example:**
```
Please transcribe this podcast: https://example.com/podcast.mp3
```

## Output Formats

- **txt**: Plain text transcription (default)
- **srt**: SubRip subtitle format with timestamps
- **json**: Structured JSON with text, metadata, and segments

## Development

To run in development mode:
```bash
npm run dev
```

## Logging

Logs are written to:
- `logs/error.log` - Error logs only
- `logs/combined.log` - All logs

Set `LOG_LEVEL` environment variable to control logging verbosity (default: 'info').

## Requirements

- Node.js 18+
- ffmpeg (for audio processing)
- OpenAI API key

## Troubleshooting

1. **File not found errors**: Ensure the file path is absolute
2. **API key errors**: Check that OPENAI_API_KEY is set correctly
3. **Large file issues**: Files are automatically chunked, but very large files may take time
4. **Format errors**: Ensure the audio format is supported (mp3, m4a, wav, etc.)

## License

MIT