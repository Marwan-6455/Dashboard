import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, CheckSquare, ArrowRight, Clock, Users, ShieldAlert } from 'lucide-react';
import { Task } from '../types/index.js';
import { PriorityBadge } from './PriorityBadge.js';
import { StatusBadge } from './StatusBadge.js';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
  onNavigate: (page: string, params?: any) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onSelectTask,
  onNavigate
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredTasks = useMemo(() => {
    if (!query.trim()) {
      return tasks.slice(0, 8); // Top recent tasks when query is empty
    }
    const q = query.toLowerCase().trim();
    return tasks
      .filter((t) => {
        return (
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.category && t.category.toLowerCase().includes(q)) ||
          (t.owner_name && t.owner_name.toLowerCase().includes(q)) ||
          ((t as any).team_name && (t as any).team_name.toLowerCase().includes(q))
        );
      })
      .slice(0, 10);
  }, [tasks, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredTasks.length > 0 ? (prev + 1) % filteredTasks.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredTasks.length > 0 ? (prev - 1 + filteredTasks.length) % filteredTasks.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTasks[selectedIndex]) {
        onSelectTask(filteredTasks[selectedIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 6, 9, 0.82)',
        backdropFilter: 'blur(8px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh'
      }}
      onClick={onClose}
    >
      <div
        className="modal-container"
        style={{
          width: '640px',
          maxWidth: '92vw',
          backgroundColor: '#12141C',
          border: '1px solid #282E3C',
          borderRadius: '10px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.85), 0 0 1px rgba(255, 94, 30, 0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modal-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: '1px solid #202532',
            backgroundColor: '#151822'
          }}
        >
          <Search size={18} color="var(--accent-orange)" />
          <input
            ref={inputRef}
            type="text"
            className="form-control"
            placeholder="Search tasks by ID, title, team, or developer... (↑↓ to navigate, Enter to open)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: 0,
              fontSize: '14px',
              color: '#F5F6F8',
              outline: 'none',
              boxShadow: 'none'
            }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              style={{ color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          ) : (
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: '#64748B',
                backgroundColor: '#1B1F2A',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid #252B3A'
              }}
            >
              ESC
            </span>
          )}
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '8px' }}>
          {filteredTasks.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No tasks found matching "{query}".
            </div>
          ) : (
            filteredTasks.map((t, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    onSelectTask(t.id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? 'rgba(255, 94, 30, 0.1)' : 'transparent',
                    border: isSelected ? '1px solid rgba(255, 94, 30, 0.3)' : '1px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.1s ease',
                    marginBottom: '2px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <span
                      className="mono"
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: 'var(--accent-orange)',
                        flexShrink: 0
                      }}
                    >
                      {t.id}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#F5F6F8',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {t.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '11px', color: '#64748B' }}>
                        <span>{(t as any).team_name || 'Studio'}</span>
                        <span>•</span>
                        <span>{t.owner_name || 'Unassigned'}</span>
                        {t.deadline && (
                          <>
                            <span>•</span>
                            <span className="mono">Due {new Date(t.deadline).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
                    <ArrowRight size={14} color={isSelected ? 'var(--accent-orange)' : '#475569'} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Footer Shortcuts */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            backgroundColor: '#0D0F15',
            borderTop: '1px solid #202532',
            fontSize: '11.5px',
            color: '#64748B'
          }}
        >
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>
              <kbd style={{ fontFamily: 'var(--font-mono)', padding: '1px 5px', backgroundColor: '#1A1E29', borderRadius: '3px', border: '1px solid #282E3C', color: '#CBD5E1' }}>↑↓</kbd> Navigate
            </span>
            <span>
              <kbd style={{ fontFamily: 'var(--font-mono)', padding: '1px 5px', backgroundColor: '#1A1E29', borderRadius: '3px', border: '1px solid #282E3C', color: '#CBD5E1' }}>↵</kbd> Open Task
            </span>
            <span>
              <kbd style={{ fontFamily: 'var(--font-mono)', padding: '1px 5px', backgroundColor: '#1A1E29', borderRadius: '3px', border: '1px solid #282E3C', color: '#CBD5E1' }}>esc</kbd> Dismiss
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('tasks');
              }}
              style={{
                color: 'var(--accent-orange)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '11.5px'
              }}
            >
              Browse All Tasks →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
