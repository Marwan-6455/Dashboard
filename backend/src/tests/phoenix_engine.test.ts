import { describe, it, expect } from 'vitest';
import {
  stepPhoenixEngine,
  createInitialPhoenixEngineState,
  getPhoenixSafeBounds,
  selectNextTargetX,
  MAX_SPEED_CAP,
  MAX_DT_CAP,
  PHOENIX_SPEEDS,
  PHOENIX_REST_DURATIONS,
  PhoenixEngineConfig,
  PhoenixEngineState
} from '../../../frontend/src/utils/phoenixEngine.js';

describe('Cindermarch Phoenix Companion — Engine & Movement Controller', () => {
  const baseConfig: PhoenixEngineConfig = {
    speedMode: 'normal',
    reducedMotion: false,
    avatarWidth: 68,
    avatarHeight: 65,
    corridorWidth: 1200,
    corridorHeight: 98
  };

  it('1. Bounds Enforcement: Keeps the mascot strictly within the top corridor', () => {
    const bounds = getPhoenixSafeBounds(1200, 98, 68, 65);
    expect(bounds.minX).toBe(24);
    expect(bounds.maxX).toBe(1200 - 68 - 24); // 1108
    expect(bounds.minY).toBe(6);
    expect(bounds.maxY).toBe(98 - 65 - 8); // 25

    // Test out of bounds positions
    let state = createInitialPhoenixEngineState(-50, -20);
    state = stepPhoenixEngine(state, baseConfig, 0.016);
    expect(state.x).toBeGreaterThanOrEqual(bounds.minX);
    expect(state.y).toBeGreaterThanOrEqual(bounds.minY);

    state.x = 2500;
    state.y = 500;
    state = stepPhoenixEngine(state, baseConfig, 0.016);
    expect(state.x).toBeLessThanOrEqual(bounds.maxX);
    expect(state.y).toBeLessThanOrEqual(bounds.maxY);
  });

  it('2. Target Selection: Correctly selects alternate targets across corridor halves', () => {
    // When on left half, target must be on right half (> 50% span)
    for (let i = 0; i < 20; i++) {
      const targetFromLeft = selectNextTargetX(100, 24, 1108, Math.random());
      expect(targetFromLeft).toBeGreaterThan(24 + (1108 - 24) * 0.5);
      expect(targetFromLeft).toBeLessThanOrEqual(1108);
    }

    // When on right half, target must be on left half (< 50% span)
    for (let i = 0; i < 20; i++) {
      const targetFromRight = selectNextTargetX(900, 24, 1108, Math.random());
      expect(targetFromRight).toBeLessThan(24 + (1108 - 24) * 0.5);
      expect(targetFromRight).toBeGreaterThanOrEqual(24);
    }
  });

  it('3. Speed Limits: Movement speed never exceeds 90 px/s under any circumstances', () => {
    let state = createInitialPhoenixEngineState(100, 15);
    state.state = 'FLYING';
    state.speed = 85;
    state.targetX = 1000;
    state.facing = 1;

    // Simulate 300 frames with maximum brisk speed
    const briskConfig: PhoenixEngineConfig = {
      ...baseConfig,
      speedMode: 'brisk'
    };

    for (let frame = 0; frame < 300; frame++) {
      state = stepPhoenixEngine(state, briskConfig, 0.016);
      expect(state.speed).toBeLessThanOrEqual(MAX_SPEED_CAP);
      expect(state.speed).toBeLessThanOrEqual(PHOENIX_SPEEDS.brisk);
    }
  });

  it('4. Calm Mode: Enforces slowest cruising speed (48 px/s) and extended rest intervals', () => {
    expect(PHOENIX_SPEEDS.calm).toBe(48);
    expect(PHOENIX_SPEEDS.calm).toBeLessThan(PHOENIX_SPEEDS.normal);

    const calmRest = PHOENIX_REST_DURATIONS.calm;
    const normalRest = PHOENIX_REST_DURATIONS.normal;
    expect(calmRest[0]).toBeGreaterThan(normalRest[0]);
    expect(calmRest[1]).toBeGreaterThan(normalRest[1]);

    const calmConfig: PhoenixEngineConfig = {
      ...baseConfig,
      speedMode: 'calm'
    };

    let state = createInitialPhoenixEngineState(100, 15);
    state.state = 'FLYING';
    state.targetX = 900;
    state.facing = 1;

    for (let f = 0; f < 200; f++) {
      state = stepPhoenixEngine(state, calmConfig, 0.016);
      expect(state.speed).toBeLessThanOrEqual(PHOENIX_SPEEDS.calm);
    }
  });

  it('5. Stall & Tab Suspension Protection: Capped delta time prevents sudden jumps or teleporting', () => {
    let state = createInitialPhoenixEngineState(100, 15);
    state.state = 'FLYING';
    state.speed = 50;
    state.targetX = 900;
    state.facing = 1;

    const initialX = state.x;
    // Simulate a 10-second tab suspension / stall
    const largeDt = 10.0;
    state = stepPhoenixEngine(state, baseConfig, largeDt);

    // Because dt is capped at MAX_DT_CAP (0.05s = 50ms), distance traveled cannot exceed speed * 0.05s
    const maxDistanceInOneStep = MAX_SPEED_CAP * MAX_DT_CAP; // 90 * 0.05 = 4.5px
    expect(state.x - initialX).toBeLessThanOrEqual(maxDistanceInOneStep + 0.1);
  });

  it('6. State Transitions: Smooth progression from RESTING -> TURNING -> FLYING -> GLIDING -> HOVERING', () => {
    let state = createInitialPhoenixEngineState(80, 15);
    state.state = 'RESTING';
    state.stateTimer = 0.01; // trigger rest expiration on next step
    state.facing = -1; // facing left initially

    // Step 1: Rest expires, target is selected on right side -> transitions to TURNING
    state = stepPhoenixEngine(state, baseConfig, 0.02);
    expect(state.state).toBe('TURNING');
    expect(state.turnNewFacing).toBe(1);

    // Step 2: Complete the turn
    state.stateTimer = 0.005;
    state = stepPhoenixEngine(state, baseConfig, 0.01);
    expect(state.state).toBe('FLYING');
    expect(state.facing).toBe(1);

    // Step 3: Fast-forward flight towards target until deceleration distance is reached
    state.targetX = 300;
    state.x = 280; // very close to target
    state.speed = 60;
    state = stepPhoenixEngine(state, baseConfig, 0.016);
    expect(state.state).toBe('GLIDING');
    expect(state.currentFrameSrc).toContain('fly_2.png'); // Wings outstretched during glide

    // Step 4: Complete glide into target
    state.speed = 1.0;
    state.x = state.targetX;
    state = stepPhoenixEngine(state, baseConfig, 0.016);
    expect(state.state).toBe('HOVERING');
    expect(state.speed).toBe(0);
  });

  it('7. Reduced Motion Mode: Completely stationary in safe hover with zero velocity', () => {
    const reducedMotionConfig: PhoenixEngineConfig = {
      ...baseConfig,
      reducedMotion: true
    };

    let state = createInitialPhoenixEngineState(200, 15);
    state.speed = 60;
    state.bank = 8;

    state = stepPhoenixEngine(state, reducedMotionConfig, 0.016);
    expect(state.state).toBe('HOVERING');
    expect(state.speed).toBe(0);
    expect(state.bank).toBe(0);

    const stationaryX = state.x;
    for (let f = 0; f < 60; f++) {
      state = stepPhoenixEngine(state, reducedMotionConfig, 0.016);
      expect(state.x).toBe(stationaryX);
      expect(state.speed).toBe(0);
    }
  });

  it('8. Sprite Animation Stability: Wing flap rate is fixed and independent of movement speed', () => {
    let state = createInitialPhoenixEngineState(100, 15);
    state.state = 'FLYING';
    state.targetX = 900;
    state.facing = 1;
    state.frameTimer = 0;
    state.frameIndex = 0;

    // Advance by 100ms (not yet 110ms)
    state = stepPhoenixEngine(state, baseConfig, 0.05);
    state = stepPhoenixEngine(state, baseConfig, 0.05);
    expect(state.frameIndex).toBe(0);

    // Advance past 110ms threshold
    state = stepPhoenixEngine(state, baseConfig, 0.02);
    expect(state.frameIndex).toBe(1);
    expect(state.currentFrameSrc).toContain('fly_1.png');
  });
});
