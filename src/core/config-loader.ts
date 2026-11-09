import fs from 'node:fs';
import path from 'node:path';
import { AppSentinelConfigSchema, type AppSentinelConfig } from '../types/config.js';

export class ConfigLoader {
  public static load(configPath?: string): AppSentinelConfig {
    const candidatePaths = [
      configPath,
      process.env.APPSENTINEL_CONFIG,
      './apps.config.json',
      './examples/apps.config.json',
    ].filter(Boolean) as string[];

    let resolvedPath: string | null = null;
    for (const p of candidatePaths) {
      const fullPath = path.resolve(p);
      if (fs.existsSync(fullPath)) {
        resolvedPath = fullPath;
        break;
      }
    }

    if (!resolvedPath) {
      // Return default minimal config if no file found
      return AppSentinelConfigSchema.parse({});
    }

    try {
      const rawText = fs.readFileSync(resolvedPath, 'utf8');
      const expanded = ConfigLoader.expandEnvVars(rawText);
      const parsedJson = JSON.parse(expanded);
      return AppSentinelConfigSchema.parse(parsedJson);
    } catch (err) {
      throw new Error(
        `Failed to parse configuration file at '${resolvedPath}': ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  private static expandEnvVars(text: string): string {
    return text.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, varName) => {
      return process.env[varName] || '';
    });
  }
}
