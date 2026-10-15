import React, { useState, useEffect, useMemo } from 'react';
import { Volume2, VolumeX, EyeOff, Minus, ChevronUp, Sparkles, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface CompanionPrefs {
  minimized: boolean;
  muted: boolean;
  hidden: boolean;
}

const STORAGE_KEY = 'cm_phoenix_companion_prefs';

export const PhoenixCompanion: React.FC = () => {
  const { notifications, unreadNotificationsCount } = useAuth();

  // Load preferences from localStorage
  const [prefs, setPrefs] = useState<CompanionPrefs>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // Ignore
    }
    return { minimized: false, muted: false, hidden: false };
  });

  const [isHovered, setIsHovered] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [reaction, setReaction] = useState<'idle' | 'alert' | 'celebrate'>('idle');

  // Save preferences
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore
    }
  }, [prefs]);

  // Determine context-aware status message from REAL data
  const statusMessage = useMemo(() => {
    if (unreadNotificationsCount > 0) {
      const latest = notifications[0];
      if (latest) {
        return `${latest.title}: ${latest.message.slice(0, 50)}...`;
      }
      return `${unreadNotificationsCount} pending studio notifications await.`;
    }

    return 'Terminal 6 Engine Hub online. Systems nominal.';
  }, [unreadNotificationsCount, notifications]);

  // React to notification changes
  useEffect(() => {
    if (unreadNotificationsCount > 0) {
      setReaction('alert');
      const timer = setTimeout(() => setReaction('idle'), 4000);
      return () => clearTimeout(timer);
    }
  }, [unreadNotificationsCount]);

  if (prefs.hidden) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '12px',
          right: '16px',
          zIndex: 900,
          pointerEvents: 'auto'
        }}
      >
        <button
          type="button"
          onClick={() => setPrefs(p => ({ ...p, hidden: false }))}
          className="btn btn-secondary btn-sm"
          style={{
            fontSize: '11px',
            padding: '4px 8px',
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--accent-orange)'
          }}
          title="Restore Cindermarch Phoenix Companion"
        >
          <Sparkles size={12} />
          <span>Summon Phoenix</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Cindermarch Phoenix Companion"
      className="phoenix-dock-container"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '24px',
        zIndex: 950,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
        userSelect: 'none'
      }}
    >
      {/* Speech Bubble (only if not muted and not minimized) */}
      {!prefs.muted && !prefs.minimized && (
        <div
          role="status"
          aria-live="polite"
          style={{
            pointerEvents: 'auto',
            maxWidth: '280px',
            backgroundColor: 'rgba(18, 18, 18, 0.95)',
            backdropFilter: 'blur(8px)',
            border: reaction === 'alert' ? '1px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            fontSize: '12px',
            color: 'var(--text-white)',
            lineHeight: '1.4',
            position: 'relative',
            animation: 'phoenix-speech-fade 0.3s ease-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                color: 'var(--accent-orange)',
                letterSpacing: '0.5px',
                textTransform: 'uppercase'
              }}
            >
              Cindermarch Phoenix
            </span>
            {reaction === 'alert' && <AlertTriangle size={12} color="var(--accent-orange)" />}
          </div>
          <div>{statusMessage}</div>
          <div
            style={{
              position: 'absolute',
              bottom: '-6px',
              right: '28px',
              width: '12px',
              height: '12px',
              backgroundColor: 'rgba(18, 18, 18, 0.95)',
              borderRight: reaction === 'alert' ? '1px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
              borderBottom: reaction === 'alert' ? '1px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
              transform: 'rotate(45deg)'
            }}
          />
        </div>
      )}

      {/* Mascot Element + Controls Bar */}
      <div
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        {/* Controls Overlay when hovered */}
        {isHovered && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'rgba(26, 26, 26, 0.95)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '20px',
              padding: '2px 6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              animation: 'phoenix-speech-fade 0.2s ease-out'
            }}
          >
            <button
              type="button"
              onClick={() => setPrefs(p => ({ ...p, muted: !p.muted }))}
              title={prefs.muted ? 'Unmute speech' : 'Mute speech'}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                color: prefs.muted ? 'var(--text-secondary)' : 'var(--accent-orange)',
                cursor: 'pointer'
              }}
            >
              {prefs.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <button
              type="button"
              onClick={() => setPrefs(p => ({ ...p, minimized: !p.minimized }))}
              title={prefs.minimized ? 'Expand companion' : 'Minimize companion'}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              {prefs.minimized ? <ChevronUp size={14} /> : <Minus size={14} />}
            </button>
            <button
              type="button"
              onClick={() => setPrefs(p => ({ ...p, hidden: true }))}
              title="Hide companion"
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <EyeOff size={14} />
            </button>
          </div>
        )}

        {/* Mascot Avatar Widget */}
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => setPrefs(p => ({ ...p, minimized: !p.minimized }))}
          role="button"
          tabIndex={0}
          title="Cindermarch Studio Phoenix Companion (Click to toggle)"
          style={{
            width: prefs.minimized ? '36px' : '58px',
            height: prefs.minimized ? '36px' : '58px',
            borderRadius: '50%',
            backgroundColor: '#0D0D0D',
            border: reaction === 'alert' ? '2px solid var(--accent-orange)' : '1px solid rgba(255,106,0,0.4)',
            boxShadow: reaction === 'alert'
              ? '0 0 20px rgba(255, 106, 0, 0.7)'
              : '0 4px 16px rgba(0,0,0,0.8), 0 0 12px rgba(255,106,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative'
          }}
          className={`phoenix-mascot-orb ${reaction}`}
        >
          {/* Cindermarch Phoenix SVG Artwork */}
          <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              width: prefs.minimized ? '26px' : '44px',
              height: prefs.minimized ? '26px' : '44px',
              transition: 'transform 0.3s ease',
              filter: 'drop-shadow(0 0 4px rgba(255,106,0,0.5))'
            }}
            className="phoenix-mascot-svg"
          >
            <defs>
              <linearGradient id="phFlame" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFA14A" />
                <stop offset="50%" stopColor="#FF6A00" />
                <stop offset="100%" stopColor="#D94B00" />
              </linearGradient>
              <linearGradient id="phMetal" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F5F5F5" />
                <stop offset="50%" stopColor="#C0C0C0" />
                <stop offset="100%" stopColor="#888888" />
              </linearGradient>
            </defs>

            {/* Crest & Head Profile */}
            <path
              d="M50 18 C52 14 56 12 60 14 C56 17 54 20 54 23 C58 20 63 21 66 24 C62 26 58 28 55 28 C57 32 55 35 50 36 C47 33 46 29 48 25 C47 23 45 20 50 18 Z"
              fill="url(#phFlame)"
            />
            {/* Beak */}
            <path
              d="M48 24 L42 27 L48 29 Z"
              fill="#FFFFFF"
            />
            {/* Eye */}
            <circle cx="51" cy="25" r="1.5" fill="#FFFFFF" />

            {/* Left Wing (Layered industrial feathers) */}
            <g className="phoenix-wing-left">
              <path
                d="M46 36 C38 28 26 22 14 26 C22 32 30 38 38 46 C28 42 20 42 16 46 C24 50 32 54 39 58 C30 57 24 60 22 64 C30 66 38 66 45 64 Z"
                fill="url(#phFlame)"
              />
              <path
                d="M44 38 C36 32 26 28 16 32 C23 37 31 43 38 50 Z"
                fill="url(#phMetal)"
                opacity="0.8"
              />
            </g>

            {/* Right Wing (Layered industrial feathers) */}
            <g className="phoenix-wing-right">
              <path
                d="M54 36 C62 28 74 22 86 26 C78 32 70 38 62 46 C72 42 80 42 84 46 C76 50 68 54 61 58 C70 57 76 60 78 64 C70 66 62 66 55 64 Z"
                fill="url(#phFlame)"
              />
              <path
                d="M56 38 C64 32 74 28 84 32 C77 37 69 43 62 50 Z"
                fill="url(#phMetal)"
                opacity="0.8"
              />
            </g>

            {/* Center Flame Torso */}
            <path
              d="M50 34 C55 42 56 52 50 62 C44 52 45 42 50 34 Z"
              fill="#FFFFFF"
            />
            <path
              d="M50 38 C54 44 54 50 50 56 C46 50 46 44 50 38 Z"
              fill="url(#phFlame)"
            />

            {/* Tail Plumage */}
            <path
              d="M50 64 L46 76 L50 86 L54 76 Z"
              fill="url(#phFlame)"
            />
            <path
              d="M48 64 L42 74 L46 82 L48 72 Z"
              fill="#D94B00"
            />
            <path
              d="M52 64 L58 74 L54 82 L52 72 Z"
              fill="#D94B00"
            />
          </svg>

          {/* Pulse beacon dot when unread notifications */}
          {unreadNotificationsCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-orange)',
                boxShadow: '0 0 8px var(--accent-orange)'
              }}
            />
          )}
        </div>
      </div>
    </aside>
  );
};
