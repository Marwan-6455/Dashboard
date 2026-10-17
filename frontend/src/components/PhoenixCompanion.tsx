import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Flame } from 'lucide-react';
import {
  stepPhoenixEngine,
  createInitialPhoenixEngineState,
  getPhoenixSafeBounds,
  PHOENIX_FLY_FRAMES,
  PHOENIX_HOVER_FRAMES,
  PhoenixEngineConfig,
  PhoenixEngineState,
  PhoenixSpeedMode
} from '../utils/phoenixEngine';

export interface PhoenixPrefs {
  enabled: boolean;
  reducedMotion: boolean;
  size: 'compact' | 'normal' | 'large';
  speed: PhoenixSpeedMode;
  muted: boolean;
}

export const STORAGE_KEY = 'cm_phoenix_companion_prefs';

export const PhoenixCompanion: React.FC = () => {
  // DOM References
  const corridorRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Authoritative Single Animation Loop Controls
  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const isMouseHoveredRef = useRef<boolean>(false);
  const engineStateRef = useRef<PhoenixEngineState>(
    createInitialPhoenixEngineState(80, 14)
  );
  const corridorDimsRef = useRef<{ width: number; height: number }>({
    width: 1200,
    height: 98
  });
  const preloadedImagesRef = useRef<HTMLImageElement[]>([]);

  // Persistent settings state
  const [prefs, setPrefs] = useState<PhoenixPrefs>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          enabled: parsed.enabled ?? true,
          reducedMotion: parsed.reducedMotion ?? false,
          size: parsed.size || 'normal',
          speed: parsed.speed || 'normal',
          muted: parsed.muted ?? true
        };
      }
    } catch {
      // Ignore storage errors
    }
    return {
      enabled: true,
      reducedMotion: false,
      size: 'normal',
      speed: 'normal',
      muted: true
    };
  });

  const prefsRef = useRef<PhoenixPrefs>(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  const [isCelebrating, setIsCelebrating] = useState(false);

  // Avatar dimensions scaled to aspect ratio (108:104)
  const avatarHeight = useMemo(() => {
    switch (prefs.size) {
      case 'compact':
        return 52;
      case 'large':
        return 78;
      case 'normal':
      default:
        return 65;
    }
  }, [prefs.size]);

  const avatarWidth = useMemo(
    () => Math.round(avatarHeight * (108 / 104)),
    [avatarHeight]
  );

  // Preload and keep sprite images decoded in memory
  useEffect(() => {
    const allSrcs = [...PHOENIX_FLY_FRAMES, ...PHOENIX_HOVER_FRAMES];
    preloadedImagesRef.current = allSrcs.map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });

    return () => {
      preloadedImagesRef.current = [];
    };
  }, []);

  // Web Audio chime on mascot interaction
  const playChime = useCallback(() => {
    if (prefsRef.current.muted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch {
      // Audio autoplay policy or unavailable
    }
  }, []);

  // Synchronize preferences across tabs and SettingsPage updates
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setPrefs((p) => ({ ...p, ...parsed }));
        } catch {}
      }
    };

    const handleCustom = (e: any) => {
      if (e.detail) {
        setPrefs((p) => ({ ...p, ...e.detail }));
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('cm_phoenix_prefs_updated', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('cm_phoenix_prefs_updated', handleCustom);
    };
  }, []);

  // Keep corridor dimensions measured & observe window resizing
  useEffect(() => {
    if (!corridorRef.current) return;

    const updateDimensions = () => {
      if (corridorRef.current) {
        const rect = corridorRef.current.getBoundingClientRect();
        if (rect.width > 0) {
          corridorDimsRef.current = {
            width: rect.width,
            height: rect.height || 98
          };

          // Re-clamp position inside new corridor boundaries smoothly
          const bounds = getPhoenixSafeBounds(
            rect.width,
            rect.height || 98,
            avatarWidth,
            avatarHeight
          );
          engineStateRef.current.x = Math.max(
            bounds.minX,
            Math.min(bounds.maxX, engineStateRef.current.x)
          );
          engineStateRef.current.y = Math.max(
            bounds.minY,
            Math.min(bounds.maxY, engineStateRef.current.y)
          );
        }
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    resizeObserver.observe(corridorRef.current);
    window.addEventListener('resize', updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [avatarWidth, avatarHeight]);

  // Main Authoritative Animation Frame Loop
  useEffect(() => {
    isMountedRef.current = true;
    lastTimeRef.current = 0;

    const runFrame = (timestamp: number) => {
      if (!isMountedRef.current) return;
      if (!prefsRef.current.enabled) {
        rafIdRef.current = null;
        return;
      }

      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
        rafIdRef.current = requestAnimationFrame(runFrame);
        return;
      }

      const rawDt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const config: PhoenixEngineConfig = {
        speedMode: prefsRef.current.speed || 'normal',
        reducedMotion: prefsRef.current.reducedMotion,
        avatarWidth,
        avatarHeight,
        corridorWidth: corridorDimsRef.current.width,
        corridorHeight: corridorDimsRef.current.height
      };

      const isPaused = isMouseHoveredRef.current;
      const nextState = stepPhoenixEngine(
        engineStateRef.current,
        config,
        rawDt,
        isPaused
      );
      engineStateRef.current = nextState;

      // Apply transform directly to DOM element (no React state re-render)
      if (avatarRef.current) {
        avatarRef.current.style.transform = `translate3d(${nextState.x.toFixed(1)}px, ${nextState.y.toFixed(1)}px, 0) scaleX(${nextState.visualScaleX.toFixed(3)}) rotate(${nextState.bank.toFixed(1)}deg)`;
      }

      // Update image src only when frame changes
      if (
        imgRef.current &&
        imgRef.current.getAttribute('src') !== nextState.currentFrameSrc
      ) {
        imgRef.current.src = nextState.currentFrameSrc;
      }

      rafIdRef.current = requestAnimationFrame(runFrame);
    };

    if (prefs.enabled && !document.hidden) {
      if (rafIdRef.current === null) {
        lastTimeRef.current = 0;
        rafIdRef.current = requestAnimationFrame(runFrame);
      }
    }

    return () => {
      isMountedRef.current = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [prefs.enabled, avatarWidth, avatarHeight]);

  // Pause loop when browser tab is hidden to conserve system resources
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      } else if (prefsRef.current.enabled && isMountedRef.current) {
        lastTimeRef.current = 0; // Reset timestamp so resuming does not cause a delta spike
        if (rafIdRef.current === null) {
          const runResume = (timestamp: number) => {
            if (!isMountedRef.current || !prefsRef.current.enabled) {
              rafIdRef.current = null;
              return;
            }
            if (lastTimeRef.current === 0) {
              lastTimeRef.current = timestamp;
              rafIdRef.current = requestAnimationFrame(runResume);
              return;
            }
            const rawDt = (timestamp - lastTimeRef.current) / 1000;
            lastTimeRef.current = timestamp;

            const config: PhoenixEngineConfig = {
              speedMode: prefsRef.current.speed || 'normal',
              reducedMotion: prefsRef.current.reducedMotion,
              avatarWidth,
              avatarHeight,
              corridorWidth: corridorDimsRef.current.width,
              corridorHeight: corridorDimsRef.current.height
            };

            const nextState = stepPhoenixEngine(
              engineStateRef.current,
              config,
              rawDt,
              isMouseHoveredRef.current
            );
            engineStateRef.current = nextState;

            if (avatarRef.current) {
              avatarRef.current.style.transform = `translate3d(${nextState.x.toFixed(1)}px, ${nextState.y.toFixed(1)}px, 0) scaleX(${nextState.visualScaleX.toFixed(3)}) rotate(${nextState.bank.toFixed(1)}deg)`;
            }
            if (
              imgRef.current &&
              imgRef.current.getAttribute('src') !== nextState.currentFrameSrc
            ) {
              imgRef.current.src = nextState.currentFrameSrc;
            }

            rafIdRef.current = requestAnimationFrame(runResume);
          };

          rafIdRef.current = requestAnimationFrame(runResume);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [avatarWidth, avatarHeight]);

  // Click on mascot (joyful celebration flare)
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    playChime();
    setIsCelebrating(true);
    engineStateRef.current.state = 'CELEBRATING';
    engineStateRef.current.stateTimer = 0.75;
    setTimeout(() => {
      setIsCelebrating(false);
    }, 750);
  };

  const handleMouseEnter = () => {
    isMouseHoveredRef.current = true;
  };

  const handleMouseLeave = () => {
    isMouseHoveredRef.current = false;
  };

  // If companion is disabled in settings, do not render corridor
  if (!prefs.enabled) {
    return null;
  }

  return (
    <div
      ref={corridorRef}
      className="phoenix-flight-zone"
      aria-label="Cindermarch Phoenix Top Flight Corridor"
    >
      {/* Ambient Runway Visual Guide */}
      <div className="phoenix-flight-guide" />

      {/* Subtle Studio Telemetry Tags */}
      <div className="phoenix-flight-telemetry left">
        <Flame size={11} color="var(--accent-orange)" />
        <span>CIN-PHX // AIRSPACE PATROL</span>
      </div>

      <div className="phoenix-flight-telemetry right">
        <span>
          CORRIDOR 01 //{' '}
          {prefs.reducedMotion
            ? 'STATIONARY'
            : prefs.speed === 'calm'
            ? 'CALM PATROL'
            : 'ACTIVE PATROL'}
        </span>
      </div>

      {/* Roaming Animated Phoenix Character */}
      <div
        ref={avatarRef}
        className={`phoenix-companion-avatar ${isCelebrating ? 'celebrate-flare' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Cindermarch Phoenix Companion (Patrolling top corridor)"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${avatarWidth}px`,
          height: `${avatarHeight}px`,
          transform: `translate3d(${engineStateRef.current.x.toFixed(1)}px, ${engineStateRef.current.y.toFixed(1)}px, 0) scaleX(${engineStateRef.current.visualScaleX.toFixed(3)}) rotate(${engineStateRef.current.bank.toFixed(1)}deg)`,
          transformOrigin: 'center center',
          transition: 'none',
          willChange: 'transform'
        }}
      >
        {/* Ember Aura Glow */}
        <div className="phoenix-ember-aura" />

        {/* Hover Rune Ring */}
        <div className="phoenix-hover-ring" />

        {/* Rendered Phoenix Sprite Frame from supplied sprite sheet */}
        <img
          ref={imgRef}
          src={engineStateRef.current.currentFrameSrc}
          alt="Cindermarch Flying Phoenix Mascot"
          className="phoenix-sprite-img"
          draggable={false}
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/assets/phoenix/fly_0.png';
          }}
        />
      </div>
    </div>
  );
};
