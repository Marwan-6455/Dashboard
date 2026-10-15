import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = 'D:\\Dashboard\\test_screenshots';

async function runBrowserTests() {
  console.log('===============================================================');
  console.log('   CINDERMARCH ENGINE HUB — COMPREHENSIVE BROWSER VERIFICATION  ');
  console.log('===============================================================');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log(`[INIT] Launching Google Chrome at: ${CHROME_PATH}`);
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  page.on('console', msg => console.log(`  [BROWSER] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`  [BROWSER ERROR] ${err.message}`));

  const results: Record<string, 'PASS' | 'FAIL' | 'BLOCKED'> = {};

  try {
    // -------------------------------------------------------------
    // Test 1: Navigation & Login Page Branding
    // -------------------------------------------------------------
    console.log('\n[1/13] Verifying Login Page & Cindermarch Wordmark/Logo...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
    
    // Check for logo
    const logo = page.locator('img[alt="Cindermarch Studio Logo"]');
    const logoVisible = await logo.isVisible();
    const titleText = await page.textContent('h1');
    const hasWordmark = titleText?.includes('CINDERMARCH ENGINE HUB');

    console.log(`  - Official Logo Visible: ${logoVisible}`);
    console.log(`  - Wordmark Present: ${hasWordmark}`);

    if (logoVisible && hasWordmark) {
      results['1. Login Branding & Logo'] = 'PASS';
    } else {
      results['1. Login Branding & Logo'] = 'FAIL';
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_login_page.png') });

    // -------------------------------------------------------------
    // Test 2: Authentication (Sign In as Engine Lead)
    // -------------------------------------------------------------
    console.log('\n[2/13] Authenticating as Engine Lead...');
    // Click Engine Lead quick profile or fill form
    const leadBtn = page.locator('button:has-text("Engine Lead")');
    if (await leadBtn.isVisible()) {
      await leadBtn.click();
    } else {
      await page.fill('input[type="text"]', 'lead');
      await page.fill('input[type="password"]', 'Terminal6#Studio');
    }

    await page.click('button:has-text("Sign In to Hub")');
    await page.waitForSelector('.top-header', { timeout: 10000 });
    console.log('  - Authenticated and redirected to workspace header.');
    results['2. Multi-User Authentication'] = 'PASS';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_authenticated_hub.png') });

    // -------------------------------------------------------------
    // Test 3: Overview Page & Metrics
    // -------------------------------------------------------------
    console.log('\n[3/13] Verifying Dashboard Overview & Project Deadlines...');
    await page.waitForSelector('.metric-card', { timeout: 10000 });
    const metricsCards = await page.locator('.metric-card').count();
    const projectTag = await page.textContent('.project-tag');
    console.log(`  - Metric cards count: ${metricsCards}`);
    console.log(`  - Project Tag: ${projectTag?.trim()}`);

    if (metricsCards >= 4) {
      results['3. Overview & Computed Metrics'] = 'PASS';
    } else {
      results['3. Overview & Computed Metrics'] = 'FAIL';
    }

    // -------------------------------------------------------------
    // Test 4: Tasks Page & Locomotive Search
    // -------------------------------------------------------------
    console.log('\n[4/13] Navigating to Tasks & Searching for "Locomotive"...');
    await page.click('button.nav-link:has-text("Tasks")');
    await page.waitForSelector('.data-table', { timeout: 10000 });

    // Test Search for Locomotive
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('Locomotive');
    await page.waitForTimeout(500); // Debounce / API fetch

    const locomotiveRow = page.locator('tr:has-text("Locomotive")');
    const foundLocomotive = (await locomotiveRow.count()) > 0;
    console.log(`  - Search for "Locomotive" returned matching records: ${foundLocomotive}`);

    // Switch to Kanban View
    await page.click('button:has-text("Kanban")');
    await page.waitForSelector('.kanban-board', { timeout: 10000 });
    const kanbanCols = await page.locator('.kanban-column').count();
    console.log(`  - Kanban View rendered with ${kanbanCols} status columns.`);

    // Switch back to List View and clear search
    await page.click('button:has-text("List")');
    await page.click('button:has-text("Clear Filters")');
    await page.waitForTimeout(500);

    // Verify task T6-ENG-001 presence
    const task001 = page.locator('tr:has-text("T6-ENG-001")');
    const has001 = (await task001.count()) > 0;
    console.log(`  - Task T6-ENG-001 exists: ${has001}`);

    if (kanbanCols === 7 && has001) {
      results['4. Tasks Search & Views (List/Kanban)'] = 'PASS';
    } else {
      results['4. Tasks Search & Views (List/Kanban)'] = 'FAIL';
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_tasks_page.png') });

    // -------------------------------------------------------------
    // Test 5: Task Detail & Six Completion Gates
    // -------------------------------------------------------------
    console.log('\n[5/13] Opening Task Detail & Evaluating 6 Completion Gates...');
    // Click on T6-ENG-001
    await page.click('tr:has-text("T6-ENG-001")');
    await page.waitForSelector('.gate-widget', { timeout: 10000 });

    const gateCards = await page.locator('.gate-item').count();
    console.log(`  - Completion gate items rendered: ${gateCards}`);

    // Verify 6 distinct gate categories
    const gateText = await page.textContent('.gate-widget');
    const hasGate1 = gateText?.includes('Acceptance Criteria Verified');
    const hasGate2 = gateText?.includes('UVCS Changeset Linked');
    const hasGate3 = gateText?.includes('Independent Peer Review');
    const hasGate4 = gateText?.includes('Evidence Artifacts Attached');
    const hasGate5 = gateText?.includes('Test & Build Reports Verified');
    const hasGate6 = gateText?.includes('Task Dependencies Satisfied');

    console.log(`  - All 6 Gates verified: ${hasGate1 && hasGate2 && hasGate3 && hasGate4 && hasGate5 && hasGate6}`);

    if (gateCards === 6 && hasGate1 && hasGate2 && hasGate3 && hasGate4 && hasGate5 && hasGate6) {
      results['5. Six Task Completion Gates'] = 'PASS';
    } else {
      results['5. Six Task Completion Gates'] = 'FAIL';
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_task_detail_gates.png') });

    // Navigate back to tasks before next page
    const backBtn = page.locator('button:has-text("Back to Tasks")');
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await page.waitForTimeout(500);
    }    // -------------------------------------------------------------
    // Test 6: Team Directory & Invitations
    // -------------------------------------------------------------
    console.log('\n[6/13] Navigating to Team Directory & Checking Profiles...');
    await page.click('button.nav-link:has-text("Team")');
    await page.waitForSelector('.page-wrapper', { timeout: 10000 });
    await page.waitForSelector('.card:has-text("Engine Lead")', { timeout: 10000 });

    const hasLead = (await page.locator('.card:has-text("Engine Lead")').count()) > 0;
    const hasYehia = (await page.locator('.card:has-text("Yehia")').count()) > 0;
    const hasJoe = (await page.locator('.card:has-text("Joe")').count()) > 0;
    const hasInviteBtn = await page.locator('button:has-text("Invite Team Member")').isVisible();

    console.log(`  - Engine Lead Profile: ${hasLead}`);
    console.log(`  - Yehia Profile: ${hasYehia}`);
    console.log(`  - Joe Profile: ${hasJoe}`);
    console.log(`  - Invite Team Member Flow Available: ${hasInviteBtn}`);

    if (hasLead && hasYehia && hasJoe && hasInviteBtn) {
      results['6. Team Profiles & Member Directory'] = 'PASS';
    } else {
      results['6. Team Profiles & Member Directory'] = 'FAIL';
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_team_page.png') });

    // -------------------------------------------------------------
    // Test 7: Review Queue & Decisions
    // -------------------------------------------------------------
    console.log('\n[7/13] Checking Review Queue...');
    await page.click('button.nav-link:has-text("Reviews")');
    await page.waitForSelector('.card-title:has-text("Review Queue")', { timeout: 10000 });

    const reviewsTitle = await page.textContent('h1');
    const hasReviewsPage = reviewsTitle?.includes('Peer Review System');
    console.log(`  - Review Queue loaded: ${hasReviewsPage}`);

    results['7. Review Queue & Decisions'] = hasReviewsPage ? 'PASS' : 'FAIL';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_reviews_page.png') });

    // -------------------------------------------------------------
    // Test 8: Test Reports Page
    // -------------------------------------------------------------
    console.log('\n[8/13] Inspecting Unity Test Framework Reports...');
    await page.click('button.nav-link:has-text("Test Reports")');
    await page.waitForSelector('.data-table', { timeout: 10000 });

    const testReportsRows = await page.locator('.data-table tbody tr').count();
    console.log(`  - Test report rows present: ${testReportsRows}`);
    results['8. Test Reports & UTF Integration'] = testReportsRows > 0 ? 'PASS' : 'FAIL';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_test_reports.png') });

    // -------------------------------------------------------------
    // Test 9: Evidence & Artifacts
    // -------------------------------------------------------------
    console.log('\n[9/13] Inspecting Evidence Repository...');
    await page.click('button.nav-link:has-text("Evidence")');
    await page.waitForSelector('.card', { timeout: 10000 });

    const evidenceCards = await page.locator('.card').count();
    console.log(`  - Evidence items present: ${evidenceCards}`);
    results['9. Evidence & Artifact Storage'] = evidenceCards > 0 ? 'PASS' : 'FAIL';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_evidence_page.png') });

    // -------------------------------------------------------------
    // Test 10: Integrations & Truthful Manual UVCS Connection test
    // -------------------------------------------------------------
    console.log('\n[10/13] Verifying Integrations & Manual UVCS Connection test...');
    await page.click('button.nav-link:has-text("Integrations")');
    await page.waitForSelector('.card', { timeout: 10000 });
    await page.waitForSelector('.badge:has-text("MANUAL MODE")', { timeout: 10000 });

    const manualModeBadge = page.locator('.badge:has-text("MANUAL MODE")');
    const isManualMode = await manualModeBadge.isVisible();
    console.log(`  - Truthful Manual Mode Badge displayed: ${isManualMode}`);

    // Click "Test Connection" button
    const testConnBtn = page.locator('button:has-text("Test UVCS Connection")');
    if (await testConnBtn.isVisible()) {
      await testConnBtn.click();
      await page.waitForTimeout(500);
      const connMsg = await page.textContent('.alert');
      console.log(`  - Truthful Connection Test Output: ${connMsg?.trim()}`);
    }

    const hasDiscordBotPanel = await page.locator('text=Cindermarch Operations Bot').isVisible();
    const hasOutboxStats = await page.locator('text=OUTBOX QUEUE').isVisible();
    console.log(`  - Discord Operations Bot Control Panel visible: ${hasDiscordBotPanel}`);
    console.log(`  - Outbox Queue & Reminders Health visible: ${hasOutboxStats}`);

    results['10. Integrations & Truthful UVCS Manual Mode'] = (isManualMode && hasDiscordBotPanel) ? 'PASS' : 'FAIL';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_integrations_page.png') });

    // -------------------------------------------------------------
    // Test 11: Settings & Health Checks
    // -------------------------------------------------------------
    console.log('\n[11/13] Checking System Settings & Quality Gate Policies...');
    await page.click('button.nav-link:has-text("Settings")');
    await page.waitForSelector('.card-title:has-text("Completion Gates Policy Configuration")', { timeout: 10000 });

    const hasGatePolicies = await page.locator('.card-title:has-text("Completion Gates Policy Configuration")').isVisible();
    console.log(`  - Quality Gate Policies visible: ${hasGatePolicies}`);

    results['11. Settings & Quality Gate Policies'] = hasGatePolicies ? 'PASS' : 'FAIL';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_settings_page.png') });

    // -------------------------------------------------------------
    // Test 12: Roaming Phoenix Companion
    // -------------------------------------------------------------
    console.log('\n[12/13] Verifying Roaming Cindermarch Phoenix Companion...');
    const phoenixOrb = page.locator('.phoenix-mascot-orb');
    const hasPhoenix = await phoenixOrb.isVisible();
    const phoenixSpeech = await page.textContent('.phoenix-dock-container');
    console.log(`  - Phoenix Mascot Orb Rendered: ${hasPhoenix}`);
    console.log(`  - Phoenix Context Speech Content: "${phoenixSpeech?.slice(0, 60)}..."`);

    results['12. Roaming Phoenix Companion'] = hasPhoenix ? 'PASS' : 'FAIL';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_phoenix_mascot.png') });

    // -------------------------------------------------------------
    // Test 13: In-App Notifications
    // -------------------------------------------------------------
    console.log('\n[13/13] Verifying Notifications Bell & Dropdown...');
    const bellBtn = page.locator('button[title="Notifications"]');
    const hasBell = await bellBtn.isVisible();
    if (hasBell) {
      await bellBtn.click();
      await page.waitForTimeout(300);
      console.log('  - Notification dropdown opened.');
    }

    results['13. In-App Notifications System'] = hasBell ? 'PASS' : 'FAIL';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_notifications_dropdown.png') });

  } catch (err: any) {
    console.error('Browser automation error:', err);
    results['Final Execution Status'] = 'FAIL';
  } finally {
    await browser.close();
  }

  console.log('\n===============================================================');
  console.log('               AUTOMATED BROWSER TEST RESULTS                  ');
  console.log('===============================================================');
  for (const [testName, status] of Object.entries(results)) {
    console.log(`${status.padEnd(6)} | ${testName}`);
  }
  console.log('===============================================================');
}

runBrowserTests();
