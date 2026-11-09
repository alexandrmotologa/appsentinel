import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const tempProfile = path.join(os.tmpdir(), 'chrome_cdp_' + Date.now());

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getDebuggerUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:3456/`, { method: 'PUT' });
      const data = await res.json();
      if (data && data.webSocketDebuggerUrl) {
        return data.webSocketDebuggerUrl;
      }
    } catch (e) {
      await sleep(200);
    }
  }
  throw new Error('Could not connect to Chrome debugging endpoint');
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(new Error(msg.error.message));
          else cb.resolve(msg.result);
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function run() {
  const imagesDir = path.resolve('B:/workgit/appsentinel/docs/images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  console.log('Launching headless Chrome...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${tempProfile}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars'
  ]);

  try {
    const wsUrl = await getDebuggerUrl();
    console.log('Connected to Chrome CDP:', wsUrl);
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');

    // 1. Capture Desktop View (1440x920, 2x retina)
    console.log('Capturing Desktop Dashboard...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 920,
      deviceScaleFactor: 2,
      mobile: false
    });
    await cdp.send('Page.navigate', { url: 'http://localhost:3456/' });
    await sleep(1500);

    const shot1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(imagesDir, 'appsentinel_dashboard.png'), Buffer.from(shot1.data, 'base64'));
    console.log('✓ Saved appsentinel_dashboard.png');

    // 2. Switch to Devices tab
    console.log('Capturing Devices Breakdown...');
    await cdp.send('Runtime.evaluate', { expression: "switchTab('devices')" });
    await sleep(600);
    const shot2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(imagesDir, 'appsentinel_devices.png'), Buffer.from(shot2.data, 'base64'));
    console.log('✓ Saved appsentinel_devices.png');

    // 3. Switch to Reviews tab
    console.log('Capturing Live Reviews Stream...');
    await cdp.send('Runtime.evaluate', { expression: "switchTab('reviews')" });
    await sleep(600);
    const shot3 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(imagesDir, 'appsentinel_reviews.png'), Buffer.from(shot3.data, 'base64'));
    console.log('✓ Saved appsentinel_reviews.png');

    // 4. Capture Mobile View (390x844, 3x iPhone 15 Pro resolution)
    console.log('Capturing Mobile View (390x844)...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true
    });
    await cdp.send('Runtime.evaluate', { expression: "switchTab('incidents')" });
    await sleep(800);
    const shot4 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(imagesDir, 'appsentinel_mobile.png'), Buffer.from(shot4.data, 'base64'));
    console.log('✓ Saved appsentinel_mobile.png');

    // 5. Generate frames for Animated Demo GIF
    console.log('Generating frames for Animated Demo GIF...');
    const framesDir = path.join(os.tmpdir(), 'appsentinel_frames');
    if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

    // Reset desktop resolution for demo
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 2,
      mobile: false
    });

    // Frame 1: Dashboard with active critical incident
    await cdp.send('Page.navigate', { url: 'http://localhost:3456/' });
    await sleep(1000);
    const f1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(framesDir, 'frame_1.png'), Buffer.from(f1.data, 'base64'));

    // Frame 2: Acknowledge button clicked (badge becomes ACKNOWLEDGED live)
    await cdp.send('Runtime.evaluate', {
      expression: `
        const ackBtn = document.querySelector('.btn-outline');
        if (ackBtn) ackBtn.click();
      `
    });
    await sleep(800);
    const f2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(framesDir, 'frame_2.png'), Buffer.from(f2.data, 'base64'));

    // Frame 3: Switch to Device Breakdown tab
    await cdp.send('Runtime.evaluate', { expression: "switchTab('devices')" });
    await sleep(800);
    const f3 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(framesDir, 'frame_3.png'), Buffer.from(f3.data, 'base64'));

    // Frame 4: Switch to Live Review Stream tab
    await cdp.send('Runtime.evaluate', { expression: "switchTab('reviews')" });
    await sleep(800);
    const f4 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(framesDir, 'frame_4.png'), Buffer.from(f4.data, 'base64'));

    cdp.close();
    console.log('All screenshots and frames captured successfully!');
  } finally {
    chromeProc.kill('SIGKILL');
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch (e) {}
  }
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
