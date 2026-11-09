import fs from 'node:fs';
import path from 'node:path';
import { ClassifierFactory } from '../../core/classifier/factory.js';
import type { RawReview } from '../../types/review.js';
import { TerminalFormatters } from '../formatters.js';

export async function triageCommand(
  textOrFile: string,
  options: { provider?: 'local' | 'anthropic' | 'openai' | 'gemini'; model?: string }
): Promise<void> {
  let content = textOrFile;

  if (fs.existsSync(path.resolve(textOrFile))) {
    content = fs.readFileSync(path.resolve(textOrFile), 'utf8');
  }

  const review: RawReview = {
    id: `adhoc_${Date.now()}`,
    fingerprint: 'adhoc',
    appId: 'adhoc.app',
    appName: 'Ad-hoc App',
    platform: 'ios',
    country: 'us',
    author: 'TestUser',
    rating: 1,
    title: 'Ad-hoc Triage',
    content,
    version: null,
    date: new Date().toISOString(),
  };

  const classifier = ClassifierFactory.create({
    provider: options.provider || 'local',
    model: options.model,
  });

  TerminalFormatters.info(`Triaging input using '${classifier.name}'...`);

  const startTime = Date.now();
  const result = await classifier.triage(review);
  const elapsed = Date.now() - startTime;

  TerminalFormatters.success(`Triage completed in ${elapsed}ms:\n`);
  console.log(`  Category:    ${result.category}`);
  console.log(`  Severity:    ${result.severity}`);
  console.log(`  Device:      ${result.deviceModel || 'Not detected'}`);
  console.log(`  OS Version:  ${result.osVersion || 'Not detected'}`);
  console.log(`  App Version: ${result.extractedVersion || 'Not detected'}`);
  console.log(`  Sentiment:   ${result.sentimentScore}`);
  console.log(`  Actionable:  ${result.actionableBugReport ? 'Yes' : 'No'}`);
  console.log(`  Keywords:    ${result.keywords.join(', ') || 'None'}`);
  console.log(`  Summary:     ${result.rootCauseSummary}\n`);
}
