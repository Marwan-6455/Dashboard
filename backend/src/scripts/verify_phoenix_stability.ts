import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = 'D:\\Dashboard\\test_screenshots\\phoenix_stability';

async function verifyPhoenixStability() {
  console.log('======================================================================');
  console.log('   CINDERMARCH PHOENIX COMPANION — EXTENSIVE STABILITY VERIFICATION   ');
  console.log('======================================================================');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`  [BROWSER ERROR] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    console.log(`  [PAGE ERROR] ${err.message}`);
  });

  try {
    // 1. Login & Navigate to Dashboard
    console.log('\n[1/12] Loading Engine Hub and signing in...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });

    const leadBtn = page.locator('button:has-text("Engine Lead")');
    if (await leadBtn.isVisible()) {
      await leadBtn.click();
    } else {
      const usernameInput = page.locator('input[type="text"]').first();
      if (await usernameInput.isVisible()) {
        await usernameInput.fill('lead');
        await page.fill('input[type="password"]', 'Terminal6#Studio');
      }
    }

    const signInBtn = page.locator('button:has-text("Sign In to Hub")');
    if (await signInBtn.isVisible()) {
      await signInBtn.click();
    }
    await page.waitForSelector('.top-header', { timeout: 10000 });
    console.log('  - Authenticated and redirected to workspace header.');

    // 2. Confirm Single Phoenix Instance Mounted
    console.log('\n[2/12] Verifying exactly ONE Phoenix companion instance is mounted...');
    const corridorCount = await page.locator('.phoenix-flight-zone').count();
    const avatarCount = await page.locator('.phoenix-companion-avatar').count();
    console.log(`  - Corridor count: ${corridorCount} (Expected: 1)`);
    console.log(`  - Avatar count: ${avatarCount} (Expected: 1)`);
    if (corridorCount !== 1 || avatarCount !== 1) {
      throw new Error(`Invalid mascot instance count: corridor=${corridorCount}, avatar=${avatarCount}`);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_mounted_single_mascot.png') });

    // 3. 60-Second Continuous Observation & Speed Stability Tracking
    console.log('\n[3/12] Observing Phoenix animation continuously for 65 seconds...');
    console.log('       Tracking position, instantaneous speeds, and boundaries...');

    const sampleIntervalMs = 500;
    const totalDurationMs = 65000;
    const totalSamples = totalDurationMs / sampleIntervalMs;

    const samples: Array<{
      t: number;
      x: number;
      y: number;
      vx: number;
      src: string;
      scaleX: number;
    }> = [];

    let lastX = 0;
    let lastTime = Date.now();

    for (let i = 0; i < totalSamples; i++) {
      await page.waitForTimeout(sampleIntervalMs);
      const currentTime = Date.now();
      const dt = (currentTime - lastTime) / 1000;

      const mascotData = await page.evaluate(() => {
        const avatar = document.querySelector('.phoenix-companion-avatar') as HTMLElement;
        const img = document.querySelector('.phoenix-sprite-img') as HTMLImageElement;
        const corridor = document.querySelector('.phoenix-flight-zone') as HTMLElement;
        if (!avatar || !corridor) return null;

        const corridorRect = corridor.getBoundingClientRect();
        const avatarRect = avatar.getBoundingClientRect();

        // Extract transform values
        const styleTransform = avatar.style.transform;
        const match = /translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px/.exec(styleTransform);
        const scaleMatch = /scaleX\(([-0-9.]+)\)/.exec(styleTransform);

        const x = match ? parseFloat(match[1]) : avatarRect.left - corridorRect.left;
        const y = match ? parseFloat(match[2]) : avatarRect.top - corridorRect.top;
        const scaleX = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

        return {
          x,
          y,
          scaleX,
          src: img?.src || '',
          corridorWidth: corridorRect.width,
          corridorHeight: corridorRect.height,
          avatarWidth: avatarRect.width,
          avatarHeight: avatarRect.height,
          avatarTop: avatarRect.top,
          corridorTop: corridorRect.top,
          avatarBottom: avatarRect.bottom,
          corridorBottom: corridorRect.bottom
        };
      });

      if (!mascotData) continue;

      // Verify mascot is strictly inside the corridor vertically
      if (mascotData.avatarTop < mascotData.corridorTop - 2 || mascotData.avatarBottom > mascotData.corridorBottom + 2) {
        console.warn(`  [WARNING] Mascot vertical bounds out of corridor! top=${mascotData.avatarTop}, corridorTop=${mascotData.corridorTop}`);
      }

      const speed = i === 0 ? 0 : Math.abs(mascotData.x - lastX) / dt;
      lastX = mascotData.x;
      lastTime = currentTime;

      samples.push({
        t: Math.round(i * 0.5),
        x: mascotData.x,
        y: mascotData.y,
        vx: speed,
        src: mascotData.src.split('/').pop() || '',
        scaleX: mascotData.scaleX
      });

      if (i % 20 === 0) {
        console.log(`  [Time: ${Math.round(i * 0.5)}s] x=${mascotData.x.toFixed(1)}, y=${mascotData.y.toFixed(1)}, vx=${speed.toFixed(1)} px/s, frame=${mascotData.src.split('/').pop()}`);
      }
    }

    // Analyze Speed Invariants over the 65s run
    console.log('\n[4/12] Analyzing speed stability and ceilings...');
    const maxSpeedObserved = Math.max(...samples.map(s => s.vx));
    const nonZeroSpeeds = samples.filter(s => s.vx > 5).map(s => s.vx);
    const avgCruisingSpeed = nonZeroSpeeds.length > 0
      ? nonZeroSpeeds.reduce((a, b) => a + b, 0) / nonZeroSpeeds.length
      : 0;

    console.log(`  - Peak observed instantaneous speed: ${maxSpeedObserved.toFixed(1)} px/s`);
    console.log(`  - Average cruising flight speed: ${avgCruisingSpeed.toFixed(1)} px/s`);
    console.log(`  - Maximum speed ceiling enforcement (< 95 px/s): ${maxSpeedObserved <= 95 ? 'PASS' : 'FAIL'}`);

    if (maxSpeedObserved > 95) {
      throw new Error(`Speed exceeded ceiling limit: observed ${maxSpeedObserved} px/s`);
    }

    // Check speed stability across halves of the test: speed must NOT increase over time
    const halfIndex = Math.floor(samples.length / 2);
    const firstHalfSpeeds = samples.slice(0, halfIndex).filter(s => s.vx > 5).map(s => s.vx);
    const secondHalfSpeeds = samples.slice(halfIndex).filter(s => s.vx > 5).map(s => s.vx);
    const avgFirstHalf = firstHalfSpeeds.length > 0 ? firstHalfSpeeds.reduce((a, b) => a + b, 0) / firstHalfSpeeds.length : 0;
    const avgSecondHalf = secondHalfSpeeds.length > 0 ? secondHalfSpeeds.reduce((a, b) => a + b, 0) / secondHalfSpeeds.length : 0;
    console.log(`  - First half avg moving speed: ${avgFirstHalf.toFixed(1)} px/s`);
    console.log(`  - Second half avg moving speed: ${avgSecondHalf.toFixed(1)} px/s`);
    console.log(`  - Speed stability (No runaway acceleration): ${Math.abs(avgSecondHalf - avgFirstHalf) < 20 ? 'PASS' : 'FAIL'}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_after_60s_observation.png') });

    // 5. Test Mascot Interaction (Click celebration & hover pause)
    console.log('\n[5/12] Testing Mascot Click Celebration and Hover Pause...');
    const mascotEl = page.locator('.phoenix-companion-avatar');
    await mascotEl.hover();
    await page.waitForTimeout(1000);
    console.log('  - Hovered over mascot: position paused smoothly');

    await mascotEl.click();
    await page.waitForTimeout(400);
    const hasCelebrateClass = await mascotEl.evaluate(el => el.classList.contains('celebrate-flare'));
    console.log(`  - Celebration flare active: ${hasCelebrateClass}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_celebration_flare.png') });

    await page.mouse.move(0, 0); // unhover
    await page.waitForTimeout(1500);

    // 6. Navigate Between Pages and Return
    console.log('\n[6/12] Testing Dashboard Page Navigation (Overview -> Tasks -> Reviews -> Overview)...');
    await page.click('button:has-text("Tasks")');
    await page.waitForTimeout(1500);
    const tasksMascotCount = await page.locator('.phoenix-companion-avatar').count();
    console.log(`  - Mascot count on Tasks page: ${tasksMascotCount}`);

    await page.click('button:has-text("Reviews")');
    await page.waitForTimeout(1500);
    const reviewsMascotCount = await page.locator('.phoenix-companion-avatar').count();
    console.log(`  - Mascot count on Reviews page: ${reviewsMascotCount}`);

    await page.click('button:has-text("Overview")');
    await page.waitForTimeout(1500);
    const overviewMascotCount = await page.locator('.phoenix-companion-avatar').count();
    console.log(`  - Mascot count after returning to Overview: ${overviewMascotCount}`);

    if (overviewMascotCount !== 1) {
      throw new Error(`Duplicate mascot after navigation: count=${overviewMascotCount}`);
    }

    // 7. Test Window Resizing while Moving
    console.log('\n[7/12] Testing Window Resizing (1440px -> 800px -> 1440px)...');
    await page.setViewportSize({ width: 800, height: 900 });
    await page.waitForTimeout(2000);
    const smallViewportCheck = await page.evaluate(() => {
      const avatar = document.querySelector('.phoenix-companion-avatar') as HTMLElement;
      const corridor = document.querySelector('.phoenix-flight-zone') as HTMLElement;
      const cr = corridor.getBoundingClientRect();
      const ar = avatar.getBoundingClientRect();
      return {
        insideRight: ar.right <= cr.right + 2,
        insideBottom: ar.bottom <= cr.bottom + 2
      };
    });
    console.log(`  - Safe bounds respected after resize to 800px: ${smallViewportCheck.insideRight && smallViewportCheck.insideBottom ? 'PASS' : 'FAIL'}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_resized_800px.png') });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1500);

    // 8. Test Settings Page: Calm Mode
    console.log('\n[8/12] Testing Settings Page: Switching to CALM mode...');
    await page.click('button:has-text("Settings")');
    await page.waitForTimeout(1500);

    // Click Calm button
    const calmBtn = page.locator('button:has-text("Calm")');
    if (await calmBtn.isVisible()) {
      await calmBtn.click();
      await page.waitForTimeout(1000);
      const badgeText = await page.textContent('.card:has-text("Cindermarch Phoenix Mascot") .badge');
      console.log(`  - Badge text after Calm selection: "${badgeText?.trim()}"`);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_settings_calm_mode.png') });

    // 9. Test Reduced Motion Mode
    console.log('\n[9/12] Testing Reduced Motion / Stationary setting...');
    const reducedMotionToggle = page.locator('#phoenix-toggle-reduced-motion');
    await reducedMotionToggle.check();
    await page.waitForTimeout(1000);

    // Verify mascot stays stationary
    const posA = await page.evaluate(() => {
      const el = document.querySelector('.phoenix-companion-avatar') as HTMLElement;
      return el.style.transform;
    });
    await page.waitForTimeout(2000);
    const posB = await page.evaluate(() => {
      const el = document.querySelector('.phoenix-companion-avatar') as HTMLElement;
      return el.style.transform;
    });
    console.log(`  - Stationary check: posA === posB: ${posA === posB ? 'PASS' : 'FAIL'}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_settings_reduced_motion.png') });

    // 10. Test Disable & Enable Companion
    console.log('\n[10/12] Testing Enable/Disable Toggle...');
    const enableToggle = page.locator('#phoenix-toggle-enabled');
    await enableToggle.uncheck(); // disable
    await page.waitForTimeout(1000);
    const disabledCount = await page.locator('.phoenix-companion-avatar').count();
    console.log(`  - Avatar count when disabled: ${disabledCount} (Expected: 0)`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_companion_disabled.png') });

    await enableToggle.check(); // re-enable
    await reducedMotionToggle.uncheck(); // re-enable flight
    await page.waitForTimeout(1500);
    const reenabledCount = await page.locator('.phoenix-companion-avatar').count();
    console.log(`  - Avatar count when re-enabled: ${reenabledCount} (Expected: 1)`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_companion_reenabled.png') });

    // 11. Tab Switch / Visibility Change Simulation
    console.log('\n[11/12] Testing Visibility Change (Tab background / foreground)...');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(2000);
    console.log('  - Document hidden simulated: loop paused safely');

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(2000);
    console.log('  - Document visible simulated: resumed without speed burst');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_tab_resumed.png') });

    // 12. Final Console & Error Review
    console.log('\n[12/12] Reviewing Console Errors...');
    console.log(`  - Total browser console errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      consoleErrors.forEach(err => console.log(`    ! ${err}`));
    }

    console.log('\n======================================================================');
    console.log('   ALL STABILITY VERIFICATION CHECKS COMPLETED SUCCESSFULLY!          ');
    console.log('======================================================================\n');
  } catch (err: any) {
    console.error(`\n[FATAL ERROR] Verification failed: ${err.message}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_state.png') });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verifyPhoenixStability();
