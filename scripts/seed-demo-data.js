import { DatabaseManager } from '../dist/core/storage/database.js';
import { ReviewStore } from '../dist/core/storage/review-store.js';
import { IncidentStore } from '../dist/core/storage/incident-store.js';

const dbPath = process.env.APPSENTINEL_DB || 'data/appsentinel.db';
const db = new DatabaseManager(dbPath);
const reviewStore = new ReviewStore(db);
const incidentStore = new IncidentStore(db);

const now = new Date();

const sampleReviews = [
  {
    id: 'spot-001',
    appId: 'com.spotify.music',
    appName: 'Spotify Music & Podcasts',
    platform: 'ios',
    country: 'us',
    author: 'AlexM_92',
    rating: 1,
    title: 'App crashes immediately on launch iOS 18.2',
    content: 'Since updating to v8.9.14 on my iPhone 15 Pro with iOS 18.2, the app crashes to the home screen after showing the splash screen for 1 second. Reinstall did not help.',
    version: '8.9.14',
    date: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
    triage: {
      category: 'CRASH',
      severity: 'P1_CRITICAL',
      subsystem: 'APP_LIFECYCLE',
      suggestedMitigation: 'Audit application:didFinishLaunchingWithOptions startup sequence and third-party SDK locks.',
      deviceModel: 'iPhone 15 Pro',
      osVersion: 'iOS 18.2',
      extractedVersion: '8.9.14',
      rootCauseSummary: 'Launch crash on iOS 18.2 splash dismiss',
      actionableBugReport: true,
      sentimentScore: -0.95,
      keywords: ['crash', 'launch', 'ios 18.2', 'splash']
    }
  },
  {
    id: 'spot-002',
    appId: 'com.spotify.music',
    appName: 'Spotify Music & Podcasts',
    platform: 'ios',
    country: 'us',
    author: 'Kev_Audio',
    rating: 1,
    title: 'Instant crash on startup',
    content: 'Cannot open the app at all on iPhone 15 Pro Max. Crashes right back to springboard every single time. Please fix ASAP!',
    version: '8.9.14',
    date: new Date(now.getTime() - 12 * 60 * 1000).toISOString(),
    triage: {
      category: 'CRASH',
      severity: 'P1_CRITICAL',
      subsystem: 'APP_LIFECYCLE',
      suggestedMitigation: 'Audit application:didFinishLaunchingWithOptions startup sequence.',
      deviceModel: 'iPhone 15 Pro Max',
      osVersion: 'iOS 18.2',
      extractedVersion: '8.9.14',
      rootCauseSummary: 'Instant launch crash on iPhone 15 Pro Max',
      actionableBugReport: true,
      sentimentScore: -0.92,
      keywords: ['instant crash', 'springboard', 'startup']
    }
  },
  {
    id: 'spot-003',
    appId: 'com.spotify.music',
    appName: 'Spotify Music & Podcasts',
    platform: 'ios',
    country: 'gb',
    author: 'Sarah_T',
    rating: 1,
    title: 'Won\'t open v8.9.14',
    content: 'Updated today and now Spotify closes instantly on iPhone 14 Pro iOS 17.5. Extremely frustrating during commute.',
    version: '8.9.14',
    date: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
    triage: {
      category: 'CRASH',
      severity: 'P1_CRITICAL',
      subsystem: 'APP_LIFECYCLE',
      suggestedMitigation: 'Verify crashlytics symbolication for startup frames.',
      deviceModel: 'iPhone 14 Pro',
      osVersion: 'iOS 17.5',
      extractedVersion: '8.9.14',
      rootCauseSummary: 'Launch termination on iPhone 14 Pro',
      actionableBugReport: true,
      sentimentScore: -0.88,
      keywords: ['closes instantly', 'commute', 'update']
    }
  },
  {
    id: 'tg-001',
    appId: 'org.telegram.messenger',
    appName: 'Telegram Messenger',
    platform: 'android',
    country: 'de',
    author: 'David_Tech',
    rating: 1,
    title: 'Billing charged twice but Telegram Premium failed',
    content: 'Purchased annual Telegram Premium on Samsung Galaxy S24 Ultra with Android 15. Google Play billed my card twice, but the badge never activated and error code 4001 showed up.',
    version: '10.9.1',
    date: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
    triage: {
      category: 'IN_APP_PURCHASE_FAIL',
      severity: 'P2_HIGH',
      subsystem: 'STOREKIT_BILLING',
      suggestedMitigation: 'Verify Google Play Billing client purchase token acknowledgment loop.',
      deviceModel: 'Samsung Galaxy S24 Ultra',
      osVersion: 'Android 15',
      extractedVersion: '10.9.1',
      rootCauseSummary: 'Google Play Billing payment confirmation failure',
      actionableBugReport: true,
      sentimentScore: -0.85,
      keywords: ['billing', 'telegram premium', 'charged twice']
    }
  },
  {
    id: 'tg-002',
    appId: 'org.telegram.messenger',
    appName: 'Telegram Messenger',
    platform: 'android',
    country: 'fr',
    author: 'Elena_V',
    rating: 1,
    title: 'Cannot activate subscription Galaxy S23',
    content: 'Charged $35.99 on Samsung Galaxy S23 Android 14 but status still says free user. Restore purchases button does nothing.',
    version: '10.9.1',
    date: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
    triage: {
      category: 'IN_APP_PURCHASE_FAIL',
      severity: 'P2_HIGH',
      subsystem: 'STOREKIT_BILLING',
      suggestedMitigation: 'Verify server-side receipt validation endpoint uptime.',
      deviceModel: 'Samsung Galaxy S23',
      osVersion: 'Android 14',
      extractedVersion: '10.9.1',
      rootCauseSummary: 'Subscription restore failure and missing entitlement',
      actionableBugReport: true,
      sentimentScore: -0.82,
      keywords: ['restore purchases', 'subscription', 'galaxy s23']
    }
  },
  {
    id: 'cr-001',
    appId: 'com.supercell.clashroyale',
    appName: 'Clash Royale',
    platform: 'android',
    country: 'ro',
    author: 'GamerX_RO',
    rating: 1,
    title: 'Screen freezes during 2v2 arena match',
    content: 'Playing on Google Pixel 8 Pro with Android 15, match starts and 10 seconds in the render freezes completely with audio looping. Happens every second match.',
    version: '4.2.1',
    date: new Date(now.getTime() - 120 * 60 * 1000).toISOString(),
    triage: {
      category: 'PERFORMANCE_LAG',
      severity: 'P2_HIGH',
      subsystem: 'GPU_RENDER',
      suggestedMitigation: 'Profile Vulkan / Metal shader compilation shaders on Mali GPU.',
      deviceModel: 'Google Pixel 8 Pro',
      osVersion: 'Android 15',
      extractedVersion: '4.2.1',
      rootCauseSummary: 'GPU render pipeline freeze during match rendering',
      actionableBugReport: true,
      sentimentScore: -0.75,
      keywords: ['freezes', 'audio looping', 'vulkan']
    }
  },
  {
    id: 'spot-004',
    appId: 'com.spotify.music',
    appName: 'Spotify Music & Podcasts',
    platform: 'ios',
    country: 'us',
    author: 'AudioFan_NYC',
    rating: 5,
    title: 'Great update and sound quality',
    content: 'Loving the new lossless audio streaming options and playlist organization. Works flawlessly on iPhone 15 Pro!',
    version: '8.9.14',
    date: new Date(now.getTime() - 5 * 60 * 1000).toISOString()
  }
];

console.log('Seeding reviews...');
const triagedForCluster = [];

for (const rev of sampleReviews) {
  const result = reviewStore.insertReview({
    id: rev.id,
    appId: rev.appId,
    appName: rev.appName,
    platform: rev.platform,
    country: rev.country,
    author: rev.author,
    rating: rev.rating,
    title: rev.title,
    content: rev.content,
    version: rev.version,
    date: rev.date
  });

  if (rev.triage && result.id) {
    const triagedItem = {
      ...rev,
      fingerprint: result.fingerprint,
      triagedAt: new Date().toISOString(),
      classifierProvider: 'local'
    };
    reviewStore.saveTriagedReview(triagedItem, result.id);
    triagedForCluster.push(triagedItem);
  }
}

console.log('Seeding incident clusters...');
const cluster1 = {
  id: 'ios:com.spotify.music:8.9.14:CRASH',
  appId: 'com.spotify.music',
  appName: 'Spotify Music & Podcasts',
  platform: 'ios',
  category: 'CRASH',
  subsystem: 'APP_LIFECYCLE',
  suggestedMitigation: 'Audit application:didFinishLaunchingWithOptions startup sequence and third-party SDK locks.',
  appVersion: '8.9.14',
  deviceModels: ['iPhone 15 Pro', 'iPhone 15 Pro Max', 'iPhone 14 Pro', 'iPhone 13'],
  osVersions: ['iOS 18.2', 'iOS 17.5'],
  reviewCount: 38,
  velocityMultiplier: 4.2,
  firstSeenAt: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
  lastSeenAt: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
  severity: 'P1_CRITICAL',
  rootCauseSummary: 'App launch crash spike on iOS 18.2 (v8.9.14) within splash screen teardown',
  sampleReviews: triagedForCluster.filter(r => r.appId === 'com.spotify.music')
};
const rec1 = incidentStore.upsertIncident(cluster1, 'active');
console.log('Created Incident 1:', rec1.id);

const cluster2 = {
  id: 'android:org.telegram.messenger:10.9.1:IN_APP_PURCHASE_FAIL',
  appId: 'org.telegram.messenger',
  appName: 'Telegram Messenger',
  platform: 'android',
  category: 'IN_APP_PURCHASE_FAIL',
  subsystem: 'STOREKIT_BILLING',
  suggestedMitigation: 'Verify Google Play Billing client purchase token acknowledgment loop.',
  appVersion: '10.9.1',
  deviceModels: ['Samsung Galaxy S24 Ultra', 'Samsung Galaxy S23', 'Google Pixel 8'],
  osVersions: ['Android 15', 'Android 14'],
  reviewCount: 14,
  velocityMultiplier: 2.8,
  firstSeenAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
  lastSeenAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
  severity: 'P2_HIGH',
  rootCauseSummary: 'Google Play Billing subscription acknowledgment timeouts',
  sampleReviews: triagedForCluster.filter(r => r.appId === 'org.telegram.messenger')
};
const rec2 = incidentStore.upsertIncident(cluster2, 'acknowledged');
incidentStore.recordAlertDispatched(rec2.id, 'slack', 'sent', { text: 'Alert sent to #mobile-eng' });
console.log('Created Incident 2:', rec2.id);

const cluster3 = {
  id: 'android:com.supercell.clashroyale:4.2.1:PERFORMANCE_LAG',
  appId: 'com.supercell.clashroyale',
  appName: 'Clash Royale',
  platform: 'android',
  category: 'PERFORMANCE_LAG',
  subsystem: 'GPU_RENDER',
  suggestedMitigation: 'Profile Vulkan / Metal shader compilation shaders on Mali GPU.',
  appVersion: '4.2.1',
  deviceModels: ['Google Pixel 8 Pro', 'Google Pixel 7', 'Samsung Galaxy S22'],
  osVersions: ['Android 15', 'Android 14'],
  reviewCount: 9,
  velocityMultiplier: 1.8,
  firstSeenAt: new Date(now.getTime() - 180 * 60 * 1000).toISOString(),
  lastSeenAt: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
  severity: 'P3_MEDIUM',
  rootCauseSummary: 'GPU Vulkan pipeline stall in 2v2 arena matches',
  sampleReviews: triagedForCluster.filter(r => r.appId === 'com.supercell.clashroyale')
};
const rec3 = incidentStore.upsertIncident(cluster3, 'resolved');
console.log('Created Incident 3:', rec3.id);

const all = incidentStore.listIncidents();
console.log(`✓ Seeding finished! Total incidents: ${all.length}`);
db.close();
