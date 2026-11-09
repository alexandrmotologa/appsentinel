import type { DatabaseSync } from 'node:sqlite';
import type { DatabaseManager } from '../storage/database.js';

export interface VersionMetrics {
  version: string;
  totalReviews: number;
  averageRating: number;
  negativeCount: number;
  negativeRatePercent: number;
  crashCount: number;
  crashRatePercent: number;
  paymentCount: number;
  loginCount: number;
  topDevices: string[];
}

export interface VersionComparisonResult {
  appId: string;
  versionA: VersionMetrics;
  versionB: VersionMetrics;
  ratingDelta: number;
  crashMultiplier: number;
  recommendation: 'PROCEED' | 'INVESTIGATE' | 'PAUSE_ROLLOUT';
  reasons: string[];
}

export class VersionComparator {
  private db: DatabaseSync;

  constructor(dbManager: DatabaseManager) {
    this.db = dbManager.getRawDb();
  }

  public compare(appId: string, versionA: string, versionB: string): VersionComparisonResult {
    const metricsA = this.getMetricsForVersion(appId, versionA);
    const metricsB = this.getMetricsForVersion(appId, versionB);

    const ratingDelta = Number((metricsB.averageRating - metricsA.averageRating).toFixed(2));

    // Calculate crash multiplier
    const rateA = metricsA.crashRatePercent > 0 ? metricsA.crashRatePercent : 0.5;
    const crashMultiplier = Number((metricsB.crashRatePercent / rateA).toFixed(2));

    const reasons: string[] = [];
    let recommendation: 'PROCEED' | 'INVESTIGATE' | 'PAUSE_ROLLOUT' = 'PROCEED';

    if (metricsB.crashCount >= 3 && crashMultiplier >= 2.0) {
      recommendation = 'PAUSE_ROLLOUT';
      reasons.push(`Crash rate surged ${crashMultiplier}x compared to baseline release ${versionA}.`);
    }

    if (metricsB.negativeRatePercent - metricsA.negativeRatePercent >= 15) {
      recommendation = 'PAUSE_ROLLOUT';
      reasons.push(
        `Negative feedback percentage jumped from ${metricsA.negativeRatePercent}% to ${metricsB.negativeRatePercent}%.`
      );
    }

    if (metricsB.paymentCount >= 2 && metricsA.paymentCount === 0) {
      recommendation = 'PAUSE_ROLLOUT';
      reasons.push(`New in-app purchase failure reports detected in release ${versionB}.`);
    }

    if (recommendation !== 'PAUSE_ROLLOUT') {
      if (ratingDelta <= -0.4 || crashMultiplier >= 1.4) {
        recommendation = 'INVESTIGATE';
        reasons.push(`Negative sentiment drift observed: average rating shifted by ${ratingDelta} stars.`);
      } else {
        reasons.push(`Release ${versionB} shows stable reliability metrics comparable to ${versionA}.`);
      }
    }

    return {
      appId,
      versionA: metricsA,
      versionB: metricsB,
      ratingDelta,
      crashMultiplier,
      recommendation,
      reasons,
    };
  }

  private getMetricsForVersion(appId: string, version: string): VersionMetrics {
    const reviews = this.db
      .prepare(`
        SELECT r.rating, t.category, t.device_model
        FROM reviews r
        LEFT JOIN triaged_reviews t ON t.review_id = r.id
        WHERE r.app_id = ? AND (r.version = ? OR t.extracted_version = ?)
      `)
      .all(appId, version, version) as Array<{
        rating: number;
        category?: string;
        device_model?: string;
      }>;

    if (reviews.length === 0) {
      return {
        version,
        totalReviews: 0,
        averageRating: 0,
        negativeCount: 0,
        negativeRatePercent: 0,
        crashCount: 0,
        crashRatePercent: 0,
        paymentCount: 0,
        loginCount: 0,
        topDevices: [],
      };
    }

    const total = reviews.length;
    let sumRating = 0;
    let negativeCount = 0;
    let crashCount = 0;
    let paymentCount = 0;
    let loginCount = 0;
    const deviceCounts = new Map<string, number>();

    for (const r of reviews) {
      sumRating += r.rating;
      if (r.rating <= 2) negativeCount++;
      if (r.category === 'CRASH') crashCount++;
      if (r.category === 'IN_APP_PURCHASE_FAIL') paymentCount++;
      if (r.category === 'ACCOUNT_LOGIN') loginCount++;

      if (r.device_model) {
        deviceCounts.set(r.device_model, (deviceCounts.get(r.device_model) || 0) + 1);
      }
    }

    const avgRating = Number((sumRating / total).toFixed(2));
    const negRate = Number(((negativeCount / total) * 100).toFixed(1));
    const crashRate = Number(((crashCount / total) * 100).toFixed(1));

    const topDevices = Array.from(deviceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([d]) => d);

    return {
      version,
      totalReviews: total,
      averageRating: avgRating,
      negativeCount,
      negativeRatePercent: negRate,
      crashCount,
      crashRatePercent: crashRate,
      paymentCount,
      loginCount,
      topDevices,
    };
  }
}
