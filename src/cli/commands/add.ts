import fs from 'node:fs';
import path from 'node:path';
import { ConfigLoader } from '../../core/config-loader.js';
import type { MonitoredApp } from '../../types/config.js';
import { TerminalFormatters } from '../formatters.js';

export async function addCommand(
  platform: 'ios' | 'android',
  appId: string,
  options: {
    name?: string;
    countries?: string;
    config?: string;
  }
): Promise<void> {
  if (platform !== 'ios' && platform !== 'android') {
    TerminalFormatters.error(`Invalid platform "${platform}". Must be "ios" or "android".`);
    return;
  }

  const configPath = options.config || './apps.config.json';
  const resolvedPath = path.resolve(configPath);

  let currentConfig: ReturnType<typeof ConfigLoader.load>;
  if (fs.existsSync(resolvedPath)) {
    currentConfig = ConfigLoader.load(resolvedPath);
  } else {
    currentConfig = ConfigLoader.load();
  }

  const existing = currentConfig.apps.find((a) => a.platform === platform && a.appId === appId);
  if (existing) {
    TerminalFormatters.warn(`App "${existing.name}" (${platform}:${appId}) is already configured in ${configPath}.`);
    return;
  }

  const countries = options.countries
    ? options.countries.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean)
    : ['us'];

  const name = options.name || (platform === 'ios' ? `App ${appId}` : appId);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + `-${platform}`;

  const newApp: MonitoredApp = {
    id: slug,
    platform,
    appId,
    name,
    countries,
  };

  currentConfig.apps.push(newApp);

  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(resolvedPath, JSON.stringify(currentConfig, null, 2) + '\n', 'utf8');

  TerminalFormatters.success(`Added ${newApp.name} (${platform}:${appId}) to ${configPath}.`);
  console.log(`  Total monitored apps: ${currentConfig.apps.length}`);
}
