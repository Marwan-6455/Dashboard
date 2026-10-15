"use strict";
// End-to-end verification script testing complete live workflows against http://localhost:3001
Object.defineProperty(exports, "__esModule", { value: true });
async function runE2EVerification() {
    console.log('--- STARTING CINDERMARCH ENGINE HUB E2E LIVE VERIFICATION ---');
    const BASE_URL = 'http://localhost:3001';
    // 1. Test Health
    console.log('[1/10] Verifying Health endpoint...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const health = await healthRes.json();
    console.log('Health response:', health);
    if (health.status !== 'healthy')
        throw new Error('Health check failed');
    // 2. Test Login for Engine Lead
    console.log('\n[2/10] Testing authentication login for Engine Lead...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'lead', password: 'Terminal6#Studio' })
    });
    if (!loginRes.ok)
        throw new Error(`Login failed: ${loginRes.statusText}`);
    const loginData = await loginRes.json();
    const sessionToken = loginData.sessionToken;
    const csrfToken = loginData.csrfToken;
    console.log(`Authenticated as ${loginData.user.displayName} (${loginData.user.roles.join(', ')})`);
    const authHeaders = {
        'Content-Type': 'application/json',
        'x-session-token': sessionToken,
        'x-csrf-token': csrfToken
    };
    // 3. Test Dashboard Overview Stats
    console.log('\n[3/10] Verifying Dashboard Overview computed metrics...');
    const overviewRes = await fetch(`${BASE_URL}/api/stats/overview`, { headers: authHeaders });
    const overview = await overviewRes.json();
    console.log('Overview metrics:', overview.metrics);
    console.log('Integrations status:', {
        uvcs: overview.integrations.uvcs.status,
        unityRunner: overview.integrations.unityTestRunner.status
    });
    // 4. Test Task Creation
    console.log('\n[4/10] Creating new task for Yehia...');
    const createTaskRes = await fetch(`${BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
            title: 'Train Brake Air Pressure Leak Simulation',
            description: 'Implement pressure drop curve when emergency valve seal degrades over 5 minutes.',
            priority: 'P0',
            ownerId: 'usr_yehia',
            reviewerId: 'usr_lead',
            acceptanceCriteria: [
                'Air reservoir pressure drops at 0.2 PSI per second in leak zone',
                'Warning hiss audio triggers when pressure falls below 45 PSI'
            ]
        })
    });
    const taskData = await createTaskRes.json();
    const taskId = taskData.task.id;
    console.log(`Task created successfully: ${taskId} (${taskData.task.title})`);
    // 5. Test Completion Gate Evaluation (Must FAIL initially!)
    console.log('\n[5/10] Evaluating completion gates on newly created task (Should Fail)...');
    const gateCheckRes = await fetch(`${BASE_URL}/api/tasks/${taskId}/gates`, { headers: authHeaders });
    const gateStatus = await gateCheckRes.json();
    console.log(`Gates passed: ${gateStatus.gateStatus.passed}`);
    console.log('Remaining requirements count:', gateStatus.gateStatus.reasons.length);
    // Attempting to force Verified Complete must be rejected!
    const prematureCompleteRes = await fetch(`${BASE_URL}/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: 'Verified Complete' })
    });
    console.log('Premature completion HTTP status (Expected 422):', prematureCompleteRes.status);
    if (prematureCompleteRes.status !== 422)
        throw new Error('Premature completion was not rejected!');
    // 6. Satisfy Acceptance Criteria
    console.log('\n[6/10] Satisfying all acceptance criteria...');
    for (const criterion of taskData.task.acceptance_criteria) {
        await fetch(`${BASE_URL}/api/tasks/${taskId}/criteria/${criterion.id}`, {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify({ isSatisfied: true })
        });
    }
    console.log('Acceptance criteria all satisfied!');
    // 7. Link UVCS Changeset
    console.log('\n[7/10] Linking UVCS Changeset cs:1050...');
    await fetch(`${BASE_URL}/api/tasks/${taskId}/changesets`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
            rawChangesetId: 'cs:1050',
            comment: 'Fix leak curve interpolation and add acoustic hiss zone triggers',
            author: 'Yehia',
            branch: '/main/physics/air-brakes'
        })
    });
    console.log('UVCS Changeset linked.');
    // 8. Test Self-Approval Prevention
    console.log('\n[8/10] Testing Self-Approval Prevention rule...');
    // Request review
    const reviewReqRes = await fetch(`${BASE_URL}/api/reviews`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
            taskId,
            developerId: 'usr_yehia',
            reviewerId: 'usr_lead'
        })
    });
    const reviewData = await reviewReqRes.json();
    const reviewId = reviewData.review.id;
    // Login as Yehia (task owner) and attempt to approve their own review
    const yehiaLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'yehia', password: 'Terminal6#Studio' })
    });
    const yehiaAuth = await yehiaLoginRes.json();
    const yehiaHeaders = {
        'Content-Type': 'application/json',
        'x-session-token': yehiaAuth.sessionToken,
        'x-csrf-token': yehiaAuth.csrfToken
    };
    const selfApproveRes = await fetch(`${BASE_URL}/api/reviews/${reviewId}/decision`, {
        method: 'POST',
        headers: yehiaHeaders,
        body: JSON.stringify({
            decision: 'Approved',
            findings: 'Yehia trying to approve their own work'
        })
    });
    console.log('Self-approval rejection HTTP status (Expected 403):', selfApproveRes.status);
    const selfApproveError = await selfApproveRes.json();
    console.log('Self-approval error message:', selfApproveError.error);
    if (selfApproveRes.status !== 403)
        throw new Error('Self-approval was not rejected!');
    // Now legitimate approval by Engine Lead
    const legitimateApproveRes = await fetch(`${BASE_URL}/api/reviews/${reviewId}/decision`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
            decision: 'Approved',
            findings: 'Verified valve decay in locomotive cab PlayMode tests. Audio transitions correctly.'
        })
    });
    if (!legitimateApproveRes.ok)
        throw new Error('Legitimate review approval failed');
    console.log('Legitimate peer review approved by Engine Lead!');
    // 9. Attach Evidence and Record Test Report
    console.log('\n[9/10] Attaching Evidence and passing Test Report...');
    await fetch(`${BASE_URL}/api/evidence/upload`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
            taskId,
            description: 'Acoustic waveform capture showing 45 PSI hiss threshold',
            externalUrl: 'https://cloud.unity.com/artifacts/t6/brake_leak_spec.png',
            evidenceType: 'external_link'
        })
    });
    await fetch(`${BASE_URL}/api/test-reports`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
            taskId,
            revision: 'cs:1050',
            unityVersion: '6000.0.25f1',
            testSuite: 'PlayMode.BrakePhysics',
            result: 'Passed',
            passedCount: 8,
            failedCount: 0,
            skippedCount: 0,
            buildResult: 'Success',
            runnerIdentity: 'Engine Lead (Manual UTF verification)'
        })
    });
    console.log('Evidence and Passing Test Report recorded.');
    // 10. Final Verification Gate Check and Transition to Verified Complete
    console.log('\n[10/10] Re-evaluating completion gates and completing task...');
    const finalGateRes = await fetch(`${BASE_URL}/api/tasks/${taskId}/gates`, { headers: authHeaders });
    const finalGates = await finalGateRes.json();
    console.log('Final Gates Passed status:', finalGates.gateStatus.passed);
    if (!finalGates.gateStatus.passed) {
        console.error('Gates that failed:', finalGates.gateStatus.reasons);
        throw new Error('Final gates should have passed!');
    }
    const completeRes = await fetch(`${BASE_URL}/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: 'Verified Complete' })
    });
    const completedTask = await completeRes.json();
    console.log('Task status now:', completedTask.task.status);
    console.log('Completed timestamp:', completedTask.task.completed_at);
    if (completedTask.task.status !== 'Verified Complete') {
        throw new Error('Task did not reach Verified Complete!');
    }
    console.log('\n=============================================================');
    console.log('  ALL CINDERMARCH ENGINE HUB LIVE WORKFLOWS VERIFIED (10/10)');
    console.log('=============================================================');
}
runE2EVerification().catch((err) => {
    console.error('E2E Verification Error:', err);
    process.exit(1);
});
