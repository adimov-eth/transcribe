#!/usr/bin/env node

import { program } from 'commander';
import { config } from 'dotenv';
import chalk from 'chalk';
import { transcribeCommand } from './commands/transcribe';

// Load environment variables
config();

// Set up the CLI
program
  .name('transcribe')
  .description('Audio transcription CLI using OpenAI Whisper API')
  .version('1.0.0');

// Register commands
transcribeCommand(program);

// Error handling
program.exitOverride();

try {
  program.parse();
} catch (error: any) {
  if (error.code === 'commander.missingArgument') {
    console.error(chalk.red('Error: Missing required argument'));
  } else if (error.code === 'commander.unknownOption') {
    console.error(chalk.red('Error: Unknown option'));
  } else {
    console.error(chalk.red('Error:'), error.message || String(error));
  }
  process.exit(1);
}