/**
 * Cindermarch Phoenix Companion — Pure Movement Controller & State Machine
 *
 * Implements an authoritative, time-based, single-loop physics engine:
 * - Constant, calibrated speeds (45-80 px/s, strictly capped at 90 px/s)
 * - Safe top-corridor boundaries
 * - Predictable 5-state machine: RESTING -> TURNING -> FLYING -> GLIDING -> HOVERING
 * - Independent, stable sprite frame advancement (8-12 FPS in flight)
 * - Capped delta times preventing stalls/teleportation after background tab suspension
 */

export type PhoenixMascotState =
  | 'RESTING'
  | 'TURNING'
  | 'FLYING'
  | 'GLIDING'
  | 'HOVERING'
  | 'CELEBRATING';

export type PhoenixSpeedMode = 'calm' | 'relaxed' | 'normal' | 'brisk';

export const PHOENIX_FLY_FRAMES = [
  '/assets/phoenix/fly_0.png',
  '/assets/phoenix/fly_1.png',
  '/assets/phoenix/fly_2.png',
  '/assets/phoenix/fly_3.png'
];

export const PHOENIX_HOVER_FRAMES = [
  '/assets/phoenix/hover_0.png',
  '/assets/phoenix/hover_1.png'
];

export const PHOENIX_SPEEDS: Record<PhoenixSpeedMode, number> = {
  calm: 48,
  relaxed: 56,
  normal: 66,
  brisk: 80
};

export const MAX_SPEED_CAP = 90;
export const MAX_DT_CAP = 0.05; // 50ms cap to prevent jump after long tab stalls
export const ACCELERATION_RATE = 42; // px/s²
export const DECELERATION_RATE = 50; // px/s²

export const PHOENIX_REST_DURATIONS: Record<PhoenixSpeedMode, [number, number]> = {
  calm: [5.0, 7.0],
  relaxed: [3.5, 5.0],
  normal: [2.5, 4.0],
  brisk: [1.5, 2.5]
};

export interface PhoenixEngineConfig {
  speedMode: PhoenixSpeedMode;
  reducedMotion: boolean;
  avatarWidth: number;
  avatarHeight: number;
  corridorWidth: number;
  corridorHeight: number;
}

export interface PhoenixEngineState {
  state: PhoenixMascotState;
  x: number;
  y: number;
  facing: 1 | -1;
  visualScaleX: number;
  bank: number;
  speed: number;
  targetX: number;
  targetY: number;
  stateTimer: number;
  turnOldFacing: 1 | -1;
  turnNewFacing: 1 | -1;
  frameTimer: number;
  frameIndex: number;
  currentFrameSrc: string;
  flightWaveTime: number;
  hoverBobTime: number;
}

export function getPhoenixSafeBounds(
  corridorWidth: number,
  corridorHeight: number,
  avatarWidth: number,
  avatarHeight: number
) {
  const minX = 24;
  const maxX = Math.max(minX + 40, corridorWidth - avatarWidth - 24);
  const minY = 6;
  const maxY = Math.max(minY, corridorHeight - avatarHeight - 8);
  return { minX, maxX, minY, maxY };
}

export function selectNextTargetX(
  currentX: number,
  minX: number,
  maxX: number,
  randomVal = Math.random()
): number {
  const span = maxX - minX;
  if (span <= 40) return minX + span / 2;
  const isLeftHalf = currentX < minX + span * 0.5;
  if (isLeftHalf) {
    // Pick destination in the right 58% to 92% of the span
    const ratio = 0.58 + randomVal * 0.34;
    return Math.round(minX + span * ratio);
  } else {
    // Pick destination in the left 8% to 42% of the span
    const ratio = 0.08 + randomVal * 0.34;
    return Math.round(minX + span * ratio);
  }
}

export function createInitialPhoenixEngineState(
  initialX = 80,
  initialY = 12
): PhoenixEngineState {
  return {
    state: 'RESTING',
    x: initialX,
    y: initialY,
    facing: 1,
    visualScaleX: 1,
    bank: 0,
    speed: 0,
    targetX: initialX,
    targetY: initialY,
    stateTimer: 2.5,
    turnOldFacing: 1,
    turnNewFacing: 1,
    frameTimer: 0,
    frameIndex: 0,
    currentFrameSrc: PHOENIX_HOVER_FRAMES[0],
    flightWaveTime: 0,
    hoverBobTime: 0
  };
}

/**
 * Single Authoritative Movement Step
 * Time-based, frame-rate independent, strictly bounded.
 */
export function stepPhoenixEngine(
  state: PhoenixEngineState,
  config: PhoenixEngineConfig,
  rawDt: number,
  isPaused: boolean = false
): PhoenixEngineState {
  const next: PhoenixEngineState = { ...state };
  const bounds = getPhoenixSafeBounds(
    config.corridorWidth,
    config.corridorHeight,
    config.avatarWidth,
    config.avatarHeight
  );

  // Strictly clamp position within safe top-corridor boundaries
  next.x = Math.max(bounds.minX, Math.min(bounds.maxX, next.x));
  next.y = Math.max(bounds.minY, Math.min(bounds.maxY, next.y));

  // Reduced motion mode: remain stationary in safe hover
  if (config.reducedMotion) {
    next.state = 'HOVERING';
    next.speed = 0;
    next.bank = 0;
    next.visualScaleX = next.facing;
    next.currentFrameSrc = PHOENIX_HOVER_FRAMES[0];
    return next;
  }

  // Cap delta time to protect against tab suspension or long frame stalls
  const dt = Math.min(Math.max(0, rawDt), MAX_DT_CAP);
  if (dt <= 0) return next;

  // Paused (e.g. mouse hover): hold position and hover gently
  if (isPaused) {
    next.speed = 0;
    next.bank = 0;
    next.hoverBobTime += dt;
    next.y = Math.max(
      bounds.minY,
      Math.min(bounds.maxY, next.targetY + Math.sin(next.hoverBobTime * 2.5) * 1.5)
    );
    next.frameTimer += dt;
    if (next.frameTimer >= 0.32) {
      next.frameTimer -= 0.32;
      next.frameIndex = (next.frameIndex + 1) % PHOENIX_HOVER_FRAMES.length;
    }
    next.currentFrameSrc = PHOENIX_HOVER_FRAMES[next.frameIndex % PHOENIX_HOVER_FRAMES.length];
    return next;
  }

  const speedMode = config.speedMode || 'normal';
  const targetCruisingSpeed = Math.min(PHOENIX_SPEEDS[speedMode] || 66, MAX_SPEED_CAP);

  switch (next.state) {
    case 'RESTING': {
      next.speed = 0;
      next.bank = 0;
      next.visualScaleX = next.facing;
      next.stateTimer -= dt;

      // Gentle resting frame rhythm
      next.frameTimer += dt;
      if (next.frameTimer >= 0.35) {
        next.frameTimer -= 0.35;
        next.frameIndex = (next.frameIndex + 1) % PHOENIX_HOVER_FRAMES.length;
      }
      next.currentFrameSrc = PHOENIX_HOVER_FRAMES[next.frameIndex % PHOENIX_HOVER_FRAMES.length];

      if (next.stateTimer <= 0) {
        // Select next destination across the corridor
        const newTargetX = selectNextTargetX(next.x, bounds.minX, bounds.maxX);
        next.targetX = newTargetX;
        next.targetY = Math.round(bounds.minY + (bounds.maxY - bounds.minY) * 0.5);

        const desiredFacing: 1 | -1 = next.targetX >= next.x ? 1 : -1;
        if (desiredFacing !== next.facing) {
          next.state = 'TURNING';
          next.stateTimer = 0.25; // 250ms smooth turn
          next.turnOldFacing = next.facing;
          next.turnNewFacing = desiredFacing;
        } else {
          next.state = 'FLYING';
          next.flightWaveTime = 0;
        }
      }
      break;
    }

    case 'TURNING': {
      next.speed = 0;
      next.bank = 0;
      next.stateTimer -= dt;

      const turnProgress = Math.max(0, Math.min(1, 1 - next.stateTimer / 0.25));
      next.visualScaleX =
        next.turnOldFacing + (next.turnNewFacing - next.turnOldFacing) * turnProgress;
      next.currentFrameSrc = PHOENIX_HOVER_FRAMES[0];

      if (next.stateTimer <= 0) {
        next.facing = next.turnNewFacing;
        next.visualScaleX = next.facing;
        next.state = 'FLYING';
        next.flightWaveTime = 0;
      }
      break;
    }

    case 'FLYING': {
      next.visualScaleX = next.facing;

      // Controlled acceleration towards target cruising speed (strictly capped)
      next.speed = Math.min(
        targetCruisingSpeed,
        next.speed + ACCELERATION_RATE * dt
      );

      // Traversal step
      next.x += next.facing * next.speed * dt;
      next.x = Math.max(bounds.minX, Math.min(bounds.maxX, next.x));

      // Gentle vertical wave & banking tilt
      next.flightWaveTime += dt;
      const wave = Math.sin(next.flightWaveTime * 2.8) * 3;
      next.y = Math.max(bounds.minY, Math.min(bounds.maxY, next.targetY + wave));
      next.bank = Math.round(Math.sin(next.flightWaveTime * 2.8) * 4 * next.facing);

      // Stable wing flap animation (110ms = ~9.1 FPS, within 8-12 FPS)
      next.frameTimer += dt;
      if (next.frameTimer >= 0.11) {
        next.frameTimer -= 0.11;
        next.frameIndex = (next.frameIndex + 1) % PHOENIX_FLY_FRAMES.length;
      }
      next.currentFrameSrc = PHOENIX_FLY_FRAMES[next.frameIndex % PHOENIX_FLY_FRAMES.length];

      // Deceleration check: initiate glide when within stopping distance
      const distRemaining = Math.abs(next.targetX - next.x);
      const decelDistance = (next.speed * next.speed) / (2 * DECELERATION_RATE) + 6;
      if (distRemaining <= decelDistance) {
        next.state = 'GLIDING';
        next.currentFrameSrc = PHOENIX_FLY_FRAMES[2];
      }
      break;
    }

    case 'GLIDING': {
      next.visualScaleX = next.facing;

      // Smooth deceleration to 0
      next.speed = Math.max(0, next.speed - DECELERATION_RATE * dt);
      next.x += next.facing * next.speed * dt;
      next.x = Math.max(bounds.minX, Math.min(bounds.maxX, next.x));

      // Ease bank angle and vertical position back to neutral
      next.bank += (0 - next.bank) * Math.min(1, 8 * dt);
      next.y += (next.targetY - next.y) * Math.min(1, 5 * dt);

      // Wings outstretched (frame 2) during glide
      next.currentFrameSrc = PHOENIX_FLY_FRAMES[2];

      const distRemaining = Math.abs(next.targetX - next.x);
      if (next.speed <= 2 || distRemaining <= 2) {
        next.x = next.targetX;
        next.speed = 0;
        next.bank = 0;
        next.state = 'HOVERING';
        next.stateTimer = 1.8; // Hover before resting
        next.hoverBobTime = 0;
      }
      break;
    }

    case 'HOVERING': {
      next.speed = 0;
      next.bank = 0;
      next.visualScaleX = next.facing;
      next.stateTimer -= dt;

      // Gentle hover bobbing
      next.hoverBobTime += dt;
      next.y = Math.max(
        bounds.minY,
        Math.min(bounds.maxY, next.targetY + Math.sin(next.hoverBobTime * 2.2) * 2)
      );

      // Slow hover wing flapping (~3.1 FPS)
      next.frameTimer += dt;
      if (next.frameTimer >= 0.32) {
        next.frameTimer -= 0.32;
        next.frameIndex = (next.frameIndex + 1) % PHOENIX_HOVER_FRAMES.length;
      }
      next.currentFrameSrc = PHOENIX_HOVER_FRAMES[next.frameIndex % PHOENIX_HOVER_FRAMES.length];

      if (next.stateTimer <= 0) {
        next.state = 'RESTING';
        const [minRest, maxRest] = PHOENIX_REST_DURATIONS[speedMode] || [2.5, 4.0];
        next.stateTimer = minRest + Math.random() * (maxRest - minRest);
      }
      break;
    }

    case 'CELEBRATING': {
      next.speed = 0;
      next.bank = 0;
      next.stateTimer -= dt;
      next.currentFrameSrc = PHOENIX_FLY_FRAMES[1];

      if (next.stateTimer <= 0) {
        next.state = 'HOVERING';
        next.stateTimer = 1.2;
      }
      break;
    }
  }

  return next;
}
