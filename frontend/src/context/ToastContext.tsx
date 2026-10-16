import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration: number = 4000) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev.slice(-4), newToast]); // Keep max 5

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
    },
    [dismissToast]
  );

  const success = useCallback((message: string, title?: string) => showToast('success', message, title), [showToast]);
  const error = useCallback((message: string, title?: string) => showToast('error', message, title, 5500), [showToast]);
  const warning = useCallback((message: string, title?: string) => showToast('warning', message, title, 5000), [showToast]);
  const info = useCallback((message: string, title?: string) => showToast('info', message, title), [showToast]);

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} color="#10B981" />;
      case 'error':
        return <AlertCircle size={18} color="#EF4444" />;
      case 'warning':
        return <AlertTriangle size={18} color="#F59E0B" />;
      case 'info':
      default:
        return <Info size={18} color="#38BDF8" />;
    }
  };

  const getToastBorderColor = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'rgba(16, 185, 129, 0.4)';
      case 'error':
        return 'rgba(239, 68, 68, 0.4)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.4)';
      case 'info':
      default:
        return 'rgba(56, 189, 248, 0.4)';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, dismissToast }}>
      {children}

      {/* Floating Toast Container */}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: '10px',
          maxWidth: '380px',
          width: 'calc(100vw - 48px)',
          pointerEvents: 'none'
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            style={{
              pointerEvents: 'auto',
              backgroundColor: '#14171F',
              border: `1px solid ${getToastBorderColor(toast.type)}`,
              borderRadius: '8px',
              padding: '12px 14px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.7), 0 0 1px rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              animation: 'toast-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ flexShrink: 0, marginTop: '1px' }}>{getToastIcon(toast.type)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {toast.title && (
                <div
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#F5F6F8',
                    marginBottom: '2px',
                    letterSpacing: '0.01em'
                  }}
                >
                  {toast.title}
                </div>
              )}
              <div
                style={{
                  fontSize: '12px',
                  color: '#94A3B8',
                  lineHeight: '1.45',
                  wordBreak: 'break-word'
                }}
              >
                {toast.message}
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: '2px',
                flexShrink: 0,
                marginTop: '1px'
              }}
              title="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
