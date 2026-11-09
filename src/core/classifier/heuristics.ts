import type { IncidentCategory, IncidentSeverity, RawReview, TriageResult } from '../../types/review.js';
import type { ReviewClassifier } from './base.js';

export class LocalHeuristicClassifier implements ReviewClassifier {
  public readonly name = 'local-heuristic';

  public async triage(review: RawReview): Promise<TriageResult> {
    const text = `${review.title} ${review.content}`;
    const textLower = text.toLowerCase();

    // 1. Extract device model
    const deviceModel = this.extractDeviceModel(text);

    // 2. Extract operating system version
    const osVersion = this.extractOsVersion(text);

    // 3. Extract app version mention or use review.version
    const extractedVersion = this.extractAppVersion(text) || review.version || null;

    // 4. Identify Category
    const category = this.categorize(textLower);

    // 5. Determine Severity
    const severity = this.calculateSeverity(category, textLower, review.rating);

    // 6. Keywords
    const keywords = this.extractKeywords(textLower, category);

    // 7. Sentiment Score
    const sentimentScore = this.calculateSentiment(textLower, review.rating);

    // 8. Actionable Bug Report
    const actionableBugReport =
      category !== 'OTHER' &&
      (Boolean(deviceModel) ||
        Boolean(extractedVersion) ||
        textLower.includes('crash') ||
        textLower.includes('freeze') ||
        textLower.includes('error') ||
        textLower.includes('charged'));

    // 9. Root Cause Summary
    const rootCauseSummary = this.summarizeRootCause(
      category,
      severity,
      deviceModel,
      extractedVersion,
      review.title,
      review.content
    );

    return {
      category,
      severity,
      deviceModel,
      osVersion,
      extractedVersion,
      rootCauseSummary,
      actionableBugReport,
      sentimentScore,
      keywords,
    };
  }

  private extractDeviceModel(text: string): string | null {
    // iPhone / iPad patterns
    const appleMatch = text.match(/\b(iPhone\s*(?:1[1-6]|SE|[X876])(?:\s*(?:Pro\s*Max|Pro|Plus|mini))?|iPad\s*(?:Air|Pro|mini)?)\b/i);
    if (appleMatch) return appleMatch[1].trim();

    // Samsung Galaxy patterns
    const samsungMatch = text.match(/\b((?:Samsung\s*)?(?:Galaxy\s*)?(?:S2[0-5]|S10|Note\s*\d{1,2}|Z\s*(?:Flip|Fold)\s*\d?|A\d{2}))(?:\s*(?:Ultra|Plus|\+|\b))/i);
    if (samsungMatch) return samsungMatch[1].trim();

    // Google Pixel patterns
    const pixelMatch = text.match(/\b(Pixel\s*[4-9](?:\s*(?:Pro|a|Fold))?)\b/i);
    if (pixelMatch) return pixelMatch[1].trim();

    // OnePlus / Xiaomi / Motorola
    const genericMatch = text.match(/\b(OnePlus\s*(?:1[0-2]|Nord)|Xiaomi\s*(?:1[2-4]|Redmi\s*Note\s*\d+)|Moto\s*G\d+)\b/i);
    if (genericMatch) return genericMatch[1].trim();

    return null;
  }

  private extractOsVersion(text: string): string | null {
    const iosMatch = text.match(/\biOS\s*(\d{1,2}(?:\.\d{1,2})?)\b/i);
    if (iosMatch) return `iOS ${iosMatch[1]}`;

    const androidMatch = text.match(/\bAndroid\s*(\d{1,2}(?:\.\d{1,2})?)\b/i);
    if (androidMatch) return `Android ${androidMatch[1]}`;

    return null;
  }

  private extractAppVersion(text: string): string | null {
    const versionMatch = text.match(/\b(?:version|v|ver|update)\s*(\d+\.\d+(?:\.\d+)?)\b/i);
    return versionMatch ? versionMatch[1] : null;
  }

  private categorize(text: string): IncidentCategory {
    // Priority 1: In-App Purchase and Billing
    if (
      text.includes('charged') ||
      text.includes('refund') ||
      text.includes('billing') ||
      text.includes('payment') ||
      text.includes('bought coins') ||
      text.includes('bought gems') ||
      text.includes('deducted money') ||
      (text.includes('purchase') && (text.includes('failed') || text.includes('error') || text.includes('not received') || text.includes('stole')))
    ) {
      return 'IN_APP_PURCHASE_FAIL';
    }

    // Priority 2: Crashes & Hard Freezes
    if (
      text.includes('crash') ||
      text.includes('crashes') ||
      text.includes('crashed') ||
      text.includes('crashing') ||
      text.includes('force close') ||
      text.includes('force quit') ||
      text.includes('freeze on startup') ||
      text.includes('black screen') ||
      text.includes('kills the process') ||
      text.includes('instant close') ||
      text.includes('closes immediately')
    ) {
      return 'CRASH';
    }

    // Priority 3: Account & Login Authentication
    if (
      text.includes('login') ||
      text.includes('log in') ||
      text.includes('sign in') ||
      text.includes('signin') ||
      text.includes('password') ||
      text.includes('2fa') ||
      text.includes('account locked') ||
      text.includes('cant log') ||
      text.includes('verification code')
    ) {
      return 'ACCOUNT_LOGIN';
    }

    // Priority 4: Ad Blockers / Broken Ads
    if (
      (text.includes('ad ') || text.includes('ads ')) &&
      (text.includes('freeze') || text.includes('stuck') || text.includes('close') || text.includes('broken'))
    ) {
      return 'AD_BLOCKED';
    }

    // Priority 5: Network & Server
    if (
      text.includes('server error') ||
      text.includes('no connection') ||
      text.includes('network error') ||
      text.includes('offline error') ||
      text.includes('timeout') ||
      text.includes('cant connect to server')
    ) {
      return 'NETWORK_ERROR';
    }

    // Priority 6: Performance & Lag
    if (
      text.includes('lag') ||
      text.includes('fps drop') ||
      text.includes('stutter') ||
      text.includes('unplayable lag') ||
      text.includes('battery drain') ||
      text.includes('overheat')
    ) {
      return 'PERFORMANCE_LAG';
    }

    // Priority 7: UI Glitch
    if (
      text.includes('ui bug') ||
      text.includes('button missing') ||
      text.includes('screen cut off') ||
      text.includes('text overlapping') ||
      text.includes('layout broken')
    ) {
      return 'UI_GLITCH';
    }

    // Priority 8: Gameplay Bug
    if (
      text.includes('quest stuck') ||
      text.includes('level broken') ||
      text.includes('glitch') ||
      text.includes('bug')
    ) {
      return 'GAMEPLAY_BUG';
    }

    return 'OTHER';
  }

  private calculateSeverity(
    category: IncidentCategory,
    text: string,
    rating: number
  ): IncidentSeverity {
    if (category === 'CRASH') {
      if (
        text.includes('immediately') ||
        text.includes('startup') ||
        text.includes('launch') ||
        text.includes('instant') ||
        text.includes('unplayable') ||
        rating === 1
      ) {
        return 'P1_CRITICAL';
      }
      return 'P2_HIGH';
    }

    if (category === 'IN_APP_PURCHASE_FAIL') {
      if (text.includes('charged') || text.includes('money') || text.includes('refund')) {
        return 'P1_CRITICAL';
      }
      return 'P2_HIGH';
    }

    if (category === 'ACCOUNT_LOGIN') {
      if (text.includes('locked out') || text.includes('cannot access') || rating === 1) {
        return 'P2_HIGH';
      }
      return 'P3_MEDIUM';
    }

    if (category === 'NETWORK_ERROR' || category === 'AD_BLOCKED') {
      return rating === 1 ? 'P2_HIGH' : 'P3_MEDIUM';
    }

    if (category === 'PERFORMANCE_LAG' || category === 'GAMEPLAY_BUG') {
      return 'P3_MEDIUM';
    }

    return 'P4_LOW';
  }

  private calculateSentiment(text: string, rating: number): number {
    let score = (rating - 3) / 2; // Rating 1 -> -1.0, Rating 2 -> -0.5, Rating 3 -> 0.0

    if (text.includes('terrible') || text.includes('worst') || text.includes('hate') || text.includes('ruined')) {
      score -= 0.2;
    }
    if (text.includes('fix') || text.includes('broken')) {
      score -= 0.1;
    }

    return Math.max(-1.0, Math.min(1.0, Number(score.toFixed(2))));
  }

  private extractKeywords(text: string, category: IncidentCategory): string[] {
    const list: string[] = [category.toLowerCase().replace(/_/g, '-')];
    const candidateTerms = [
      'crash',
      'startup',
      'launch',
      'freeze',
      'black screen',
      'charged',
      'refund',
      'gems',
      'coins',
      'login',
      'sign in',
      'update',
      'battery',
      'overheating',
      'lag',
    ];

    for (const term of candidateTerms) {
      if (text.includes(term) && !list.includes(term)) {
        list.push(term);
      }
    }

    return list.slice(0, 6);
  }

  private summarizeRootCause(
    category: IncidentCategory,
    severity: IncidentSeverity,
    deviceModel: string | null,
    appVersion: string | null,
    title: string,
    content: string
  ): string {
    const devContext = deviceModel ? ` on ${deviceModel}` : '';
    const verContext = appVersion ? ` after updating to ${appVersion}` : '';

    switch (category) {
      case 'CRASH':
        return `Application termination on launch or navigation${devContext}${verContext}.`;
      case 'IN_APP_PURCHASE_FAIL':
        return `Payment transaction deducted funds without item fulfillment${verContext}.`;
      case 'ACCOUNT_LOGIN':
        return `Authentication credential validation failure preventing user sign in${devContext}.`;
      case 'AD_BLOCKED':
        return `Video advertisement failed to close or froze the gameplay frame${devContext}.`;
      case 'NETWORK_ERROR':
        return `Remote API connectivity or gateway timeout failure during active session.`;
      case 'PERFORMANCE_LAG':
        return `Severe frame rate degradation and device thermal throttling${devContext}.`;
      default:
        // Use the title or first sentence of content
        const firstSentence = content.split(/[.!?]/)[0]?.trim();
        return firstSentence || title || 'Unspecified user complaint.';
    }
  }
}
