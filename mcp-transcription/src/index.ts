#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { transcribeFile, transcribeUrl } from './transcription';
import { logger } from './logger';

const TranscribeFileSchema = z.object({
  path: z.string().describe("Path to the audio/video file to transcribe"),
  language: z.string().optional().default("auto").describe("Language code (e.g., 'en', 'ru', 'es') or 'auto' for automatic detection"),
  format: z.enum(["txt", "srt", "json"]).optional().default("txt").describe("Output format for the transcription")
});

const TranscribeUrlSchema = z.object({
  url: z.string().url().describe("URL of the audio/video file to transcribe"),
  language: z.string().optional().default("auto").describe("Language code (e.g., 'en', 'ru', 'es') or 'auto' for automatic detection"),
  format: z.enum(["txt", "srt", "json"]).optional().default("txt").describe("Output format for the transcription")
});

async function main() {
  const server = new Server(
    {
      name: "mcp-transcription",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list_tools request
  server.setRequestHandler(z.object({ method: z.literal('tools/list') }), async () => ({
    tools: [
      {
        name: "transcribe_file",
        description: "Transcribe an audio or video file to text. Supports various formats (mp3, wav, mkv, mp4, etc.) and handles large files by splitting them into chunks.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to the audio/video file to transcribe"
            },
            language: {
              type: "string",
              description: "Language code (e.g., 'en', 'ru', 'es') or 'auto' for automatic detection",
              default: "auto"
            },
            format: {
              type: "string",
              enum: ["txt", "srt", "json"],
              description: "Output format for the transcription",
              default: "txt"
            }
          },
          required: ["path"]
        }
      },
      {
        name: "transcribe_url",
        description: "Download and transcribe an audio or video file from a URL. Handles various formats and large files.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL of the audio/video file to transcribe"
            },
            language: {
              type: "string",
              description: "Language code (e.g., 'en', 'ru', 'es') or 'auto' for automatic detection",
              default: "auto"
            },
            format: {
              type: "string",
              enum: ["txt", "srt", "json"],
              description: "Output format for the transcription",
              default: "txt"
            }
          },
          required: ["url"]
        }
      }
    ]
  }));

  // Handle tool execution
  server.setRequestHandler(z.object({ method: z.literal('tools/call'), params: z.any() }), async (request: any) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "transcribe_file") {
        const params = TranscribeFileSchema.parse(args);
        logger.info(`Transcribing file: ${params.path}`);
        
        const result = await transcribeFile(params.path, {
          language: params.language,
          outputFormat: params.format
        });
        
        return {
          content: [
            {
              type: "text",
              text: result.transcription
            }
          ]
        };
      } else if (name === "transcribe_url") {
        const params = TranscribeUrlSchema.parse(args);
        logger.info(`Transcribing URL: ${params.url}`);
        
        const result = await transcribeUrl(params.url, {
          language: params.language,
          outputFormat: params.format
        });
        
        return {
          content: [
            {
              type: "text",
              text: result.transcription
            }
          ]
        };
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Tool execution failed: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP Transcription Server started");
}

main().catch((error) => {
  logger.error("Server failed to start:", error);
  process.exit(1);
});