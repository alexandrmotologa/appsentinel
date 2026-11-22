import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, '../bin/appsentinel.js');

describe('CLI Version and Help Flags', () => {
  it('outputs version with --version, -V, and -v', () => {
    for (const flag of ['--version', '-V', '-v']) {
      const out = execSync(`node "${cliPath}" ${flag}`, { encoding: 'utf8' });
      assert.ok(out.includes('1.0.0'), `Expected ${flag} output to include 1.0.0, got: ${out}`);
    }
  });

  it('outputs version with version subcommand', () => {
    const out = execSync(`node "${cliPath}" version`, { encoding: 'utf8' });
    assert.ok(out.includes('appsentinel v1.0.0'), `Expected output to include appsentinel v1.0.0, got: ${out}`);
  });

  it('outputs usage with --help and -h', () => {
    for (const flag of ['--help', '-h']) {
      const out = execSync(`node "${cliPath}" ${flag}`, { encoding: 'utf8' });
      assert.ok(out.includes('Usage: appsentinel'), `Expected ${flag} output to include Usage, got: ${out}`);
    }
  });
});
