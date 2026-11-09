import pc from 'picocolors';
import { ConfigLoader } from '../../core/config-loader.js';
import { VersionComparator } from '../../core/reporting/version-comparator.js';
import { DatabaseManager } from '../../core/storage/database.js';
import { TerminalFormatters } from '../formatters.js';

export async function compareCommand(
  appId: string,
  versionA: string,
  versionB: string,
  options: { config?: string }
): Promise<void> {
  const config = ConfigLoader.load(options.config);
  const dbManager = new DatabaseManager(config.databasePath);
  const comparator = new VersionComparator(dbManager);

  TerminalFormatters.banner();
  TerminalFormatters.info(`Comparing release reliability for ${appId}: v${versionA} vs v${versionB}...\n`);

  const result = comparator.compare(appId, versionA, versionB);

  console.log(`  Metric                      v${versionA.padEnd(10)} v${versionB.padEnd(10)} Delta`);
  console.log('  ------------------------------------------------------------------');
  console.log(`  Total Reviews               ${String(result.versionA.totalReviews).padEnd(10)} ${String(result.versionB.totalReviews).padEnd(10)} ${result.versionB.totalReviews - result.versionA.totalReviews}`);
  console.log(`  Average Star Rating         ${String(result.versionA.averageRating).padEnd(10)} ${String(result.versionB.averageRating).padEnd(10)} ${result.ratingDelta >= 0 ? '+' : ''}${result.ratingDelta}`);
  console.log(`  Negative Review Rate        ${(result.versionA.negativeRatePercent + '%').padEnd(10)} ${(result.versionB.negativeRatePercent + '%').padEnd(10)} ${(result.versionB.negativeRatePercent - result.versionA.negativeRatePercent).toFixed(1)}%`);
  console.log(`  Crash Reports               ${String(result.versionA.crashCount).padEnd(10)} ${String(result.versionB.crashCount).padEnd(10)} ${result.crashMultiplier}x surge`);
  console.log(`  Billing Failure Reports     ${String(result.versionA.paymentCount).padEnd(10)} ${String(result.versionB.paymentCount).padEnd(10)} ${result.versionB.paymentCount - result.versionA.paymentCount}`);
  console.log(`  Login Failure Reports       ${String(result.versionA.loginCount).padEnd(10)} ${String(result.versionB.loginCount).padEnd(10)} ${result.versionB.loginCount - result.versionA.loginCount}`);
  console.log('');

  let badge = '';
  if (result.recommendation === 'PAUSE_ROLLOUT') {
    badge = pc.bgRed(pc.white(pc.bold(' ⛔ STAGED ROLLOUT RECOMMENDATION: PAUSE_ROLLOUT ')));
  } else if (result.recommendation === 'INVESTIGATE') {
    badge = pc.bgYellow(pc.black(pc.bold(' ⚠️ STAGED ROLLOUT RECOMMENDATION: INVESTIGATE ')));
  } else {
    badge = pc.bgGreen(pc.black(pc.bold(' ✅ STAGED ROLLOUT RECOMMENDATION: PROCEED ')));
  }

  console.log(`  ${badge}\n`);
  for (const reason of result.reasons) {
    console.log(`  • ${reason}`);
  }
  console.log('');

  dbManager.close();
}
