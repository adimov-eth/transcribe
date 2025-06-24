import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { glob } from 'glob';
import { Transcriber, TranscriptionConfig, AudioFile } from '../../lib';

export function transcribeCommand(program: Command) {
  program
    .command('transcribe <files...>')
    .description('Transcribe audio files')
    .option('-l, --language <lang>', 'Language code (e.g., en, ru, es)', 'en')
    .option('-o, --output-dir <dir>', 'Output directory for transcripts')
    .option('-k, --api-key <key>', 'OpenAI API key (or use OPENAI_API_KEY env var)')
    .option('-c, --config <file>', 'Configuration file path')
    .option('--chunk-duration <minutes>', 'Chunk duration in minutes', '20')
    .option('--format <format>', 'Output format (txt, json, srt, vtt)', 'txt')
    .action(async (files: string[], options) => {
      const spinner = ora();

      try {
        // Get API key
        const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error('OpenAI API key is required. Set OPENAI_API_KEY env var or use --api-key');
        }

        // Load config if provided
        let config: TranscriptionConfig = {
          openai: { apiKey },
          language: options.language,
          audio: {
            chunkDuration: parseInt(options.chunkDuration) * 60,
          },
          output: {
            format: options.format,
          },
        };

        if (options.config) {
          const configFile = await fs.promises.readFile(options.config, 'utf-8');
          const fileConfig = JSON.parse(configFile);
          config = { ...config, ...fileConfig };
        }

        // Create transcriber
        const transcriber = new Transcriber(config);

        // Expand file patterns
        const audioFiles: AudioFile[] = [];
        for (const pattern of files) {
          const matches = await glob(pattern);
          for (const match of matches) {
            const resolvedPath = path.resolve(match);
            audioFiles.push({
              name: path.basename(resolvedPath),
              path: resolvedPath,
            });
          }
        }

        if (audioFiles.length === 0) {
          throw new Error('No files found matching the provided patterns');
        }

        console.log(chalk.blue(`Found ${audioFiles.length} file(s) to transcribe`));

        // Process each file
        for (const audioFile of audioFiles) {
          spinner.start(`Transcribing ${chalk.yellow(audioFile.name)}`);

          try {
            const outputPath = options.outputDir
              ? path.join(options.outputDir, audioFile.name.replace(/\.[^.]+$/, '_transcript.txt'))
              : undefined;

            await transcriber.transcribeToFile(audioFile, outputPath);
            
            spinner.succeed(`Transcribed ${chalk.green(audioFile.name)}`);
          } catch (error) {
            spinner.fail(`Failed to transcribe ${chalk.red(audioFile.name)}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        console.log(chalk.green('\n✓ Transcription complete!'));
      } catch (error) {
        spinner.fail();
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Add a separate command for batch processing with a config file
  program
    .command('batch')
    .description('Batch transcribe files from a JSON configuration')
    .requiredOption('-c, --config <file>', 'Batch configuration file')
    .action(async (options) => {
      const spinner = ora();

      try {
        const configContent = await fs.promises.readFile(options.config, 'utf-8');
        const batchConfig = JSON.parse(configContent);

        const apiKey = batchConfig.apiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error('OpenAI API key is required in config or OPENAI_API_KEY env var');
        }

        const transcriber = new Transcriber({
          openai: { apiKey },
          ...batchConfig.transcriptionConfig,
        });

        const files = batchConfig.files || [];
        console.log(chalk.blue(`Processing ${files.length} file(s) from batch config`));

        for (const file of files) {
          spinner.start(`Transcribing ${chalk.yellow(file.name || file.path)}`);

          try {
            await transcriber.transcribeToFile({
              name: file.name || path.basename(file.path),
              path: file.path,
            }, file.output);
            
            spinner.succeed(`Transcribed ${chalk.green(file.name || file.path)}`);
          } catch (error) {
            spinner.fail(`Failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        console.log(chalk.green('\n✓ Batch transcription complete!'));
      } catch (error) {
        spinner.fail();
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}