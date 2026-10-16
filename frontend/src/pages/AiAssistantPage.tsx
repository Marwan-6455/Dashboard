import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  History,
  Check,
  X,
  FileText,
  Layers,
  Bug,
  HelpCircle,
  RefreshCw,
  FolderOpen,
  Volume2,
  BookOpen,
  Users,
  Info,
  Clock,
  ShieldAlert,
  Database,
  ArrowRight
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { AIResponse, AICitation, AIDraftedAction } from '../types/index.js';
import { MarkdownRenderer } from '../components/MarkdownRenderer.js';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: AICitation[];
  draftedActions?: AIDraftedAction[];
  model?: string;
  source?: string;
  timestamp: string;
}

export const AiAssistantPage: React.FC = () => {
  const { user, activeProjectId } = useAuth();
  const toast = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showContextPanel, setShowContextPanel] = useState(true);
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; provider: string; model: string; isGeminiAvailable: boolean; integrations?: Record<string, any> } | null>(null);

  // Suggested Prompts
  const suggestedPrompts = [
    {
      id: 'blockers',
      icon: <AlertTriangle size={15} color="#EF4444" />,
      label: 'What is blocking the next Terminal 6 milestone?',
      desc: 'Inspect critical QA defects, task dependencies, and delivery risk.'
    },
    {
      id: 'bugs',
      icon: <Bug size={15} color="#F59E0B" />,
      label: 'Summarize open critical bugs and QA failures.',
      desc: 'Active defects across physics, audio, and platform targets.'
    },
    {
      id: 'release',
      icon: <ShieldCheck size={15} color="#10B981" />,
      label: 'Evaluate release readiness for Terminal 6.',
      desc: 'Audit automated test reports, builds, and governance gates.'
    },
    {
      id: 'audio',
      icon: <Volume2 size={15} color="#38BDF8" />,
      label: 'Draft a task for audio integration.',
      desc: 'Create a spatialized sound deliverable for Sound Team.'
    },
    {
      id: 'canon',
      icon: <BookOpen size={15} color="#A78BFA" />,
      label: 'Check the Story Bible for character inconsistencies.',
      desc: 'Audit Metro station canon facts and narrative threads.'
    },
    {
      id: 'teams',
      icon: <Users size={15} color="var(--accent-orange)" />,
      label: "Summarize this week's progress for all six teams.",
      desc: 'Multi-department velocity, standups, and review queues.'
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const fetchHistory = async () => {
    try {
      const res = await apiRequest('/api/ai/history');
      setHistory(res.history || []);
    } catch (err: any) {
      console.warn('Could not load AI history:', err.message);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await apiRequest('/api/ai/status');
      setAiStatus(res);
    } catch {
      // Default fallback
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchStatus();
  }, []);

  const handleSend = async (customPrompt?: string) => {
    const queryText = (customPrompt || prompt).trim();
    if (!queryText || loading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setPrompt('');
    setLoading(true);

    try {
      const res: AIResponse = await apiRequest('/api/ai/query', {
        method: 'POST',
        body: JSON.stringify({
          prompt: queryText,
          projectId: activeProjectId
        })
      });

      const assistantMessage: Message = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: res.answer,
        citations: res.citations,
        draftedActions: res.draftedActions,
        model: res.model,
        source: res.source,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMessage]);
      fetchHistory();
    } catch (err: any) {
      toast.error('AI query failed: ' + err.message);
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ **Request Error:** Unable to reach AI intelligence service: ${err.message}. Please verify the server-side GEMINI_API_KEY environment variable.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExecuteDraftedAction = async (action: AIDraftedAction) => {
    try {
      if (action.actionType === 'create_task') {
        const payload = action.payload;
        await apiRequest('/api/tasks', {
          method: 'POST',
          body: JSON.stringify({
            title: payload.title || action.title,
            description: payload.description || action.description,
            project_id: payload.project_id || activeProjectId,
            priority: payload.priority || 'Medium',
            category: payload.category || 'General',
            deadline: payload.deadline || null
          })
        });
        toast.success(`Drafted task "${action.title}" created successfully!`);
      } else {
        toast.info(`Action ${action.actionType} confirmed and submitted.`);
      }
    } catch (err: any) {
      toast.error('Failed to execute drafted action: ' + err.message);
    }
  };

  return (
    <div className="page-wrapper" style={{ paddingBottom: '20px' }}>
      <div className="ai-layout">
        {/* 4.1 Main Conversation Area */}
        <div className="ai-main-chat">
          {/* 4.2 Assistant Header */}
          <div className="ai-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--accent-orange-dim)',
                  border: '1px solid var(--accent-orange-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-orange)'
                }}
              >
                <Sparkles size={18} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-white)' }}>
                    Cindermarch Studio AI Assistant
                  </h2>
                  <span className="badge badge-verified-complete" style={{ fontSize: '10px' }}>
                    ● Operational
                  </span>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: aiStatus?.isGeminiAvailable ? 'var(--status-complete)' : 'var(--accent-orange)',
                      fontSize: '10px'
                    }}
                  >
                    {aiStatus ? (aiStatus.isGeminiAvailable ? 'Gemini 1.5 Flash API' : 'Studio Engine Telemetry') : 'AI Intelligence'}
                  </span>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontSize: '10px'
                    }}
                  >
                    {activeProjectId === 'terminal-6' ? 'Terminal 6' : activeProjectId === 'blue-note-lounge' ? 'Blue Note Lounge' : 'All Projects'}
                  </span>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Authoritative studio intelligence, cross-entity fact verification, and gated operations.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className={`btn btn-sm ${showHistory ? 'btn-primary' : 'btn-secondary'}`}
                title="Toggle Audit History"
              >
                <History size={13} />
                <span>History ({history.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setShowContextPanel(!showContextPanel)}
                className={`btn btn-sm ${showContextPanel ? 'btn-primary' : 'btn-secondary'}`}
                title="Toggle Context Telemetry Panel"
              >
                <Info size={13} />
                <span>Context</span>
              </button>
            </div>
          </div>

          {/* 4.5 Messages Scroll Area */}
          <div className="ai-messages-scroll">
            {/* 4.3 Welcome Screen Hero (Shown if 0 messages) */}
            {messages.length === 0 && (
              <div className="ai-welcome-hero">
                <span className="ai-welcome-badge">
                  <Sparkles size={12} /> Cindermarch Studio Intelligence
                </span>
                <h2 className="ai-welcome-title">Your studio. Your projects. One assistant.</h2>
                <p className="ai-welcome-desc">
                  Ask about project progress, upcoming deadlines, QA issues, production blockers, and team activity.
                  Directly scoped to <strong>{activeProjectId === 'terminal-6' ? 'Terminal 6' : activeProjectId === 'blue-note-lounge' ? 'Blue Note Lounge' : 'active studio projects'}</strong>.
                </p>

                {/* 4.4 Suggested Prompts Grid */}
                <div className="ai-prompt-grid">
                  {suggestedPrompts.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={loading}
                      onClick={() => handleSend(p.label)}
                      className="ai-prompt-card"
                    >
                      <div className="ai-prompt-label">
                        {p.icon}
                        <span>{p.label}</span>
                      </div>
                      <div className="ai-prompt-desc">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`ai-message-row ${msg.sender === 'user' ? 'user' : 'assistant'}`}
              >
                <div className={`ai-message-avatar ${msg.sender === 'user' ? 'user' : 'assistant'}`}>
                  {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>

                <div className={`ai-message-body ${msg.sender === 'user' ? 'user' : 'assistant'}`}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <strong style={{ color: msg.sender === 'user' ? '#FFFFFF' : 'var(--accent-orange)' }}>
                      {msg.sender === 'user' ? user?.displayName || 'You' : 'Cindermarch Studio AI'}
                    </strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {msg.source && (
                        <span className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                          {msg.source === 'gemini_flash_api' ? 'Gemini 2.5 Flash' : 'Studio Engine Telemetry'}
                        </span>
                      )}
                      <span>{msg.timestamp}</span>
                    </div>
                  </div>

                  {msg.sender === 'assistant' ? (
                    <MarkdownRenderer content={msg.text} />
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '13px', color: '#FFFFFF' }}>
                      {msg.text}
                    </div>
                  )}

                  {/* Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ExternalLink size={12} color="var(--accent-orange)" />
                        Authoritative Sources Cited ({msg.citations.length}):
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {msg.citations.map((c, idx) => (
                          <a
                            key={idx}
                            href={c.url}
                            className="ai-citation-pill"
                          >
                            <span className="mono" style={{ color: 'var(--accent-orange)', fontSize: '10px' }}>
                              [{c.type.toUpperCase()}]
                            </span>
                            <span style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.title}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gated High-Impact Actions */}
                  {msg.draftedActions && msg.draftedActions.length > 0 && (
                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--status-review)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} /> High-Impact Action Drafted (Confirmation Required)
                      </div>

                      {msg.draftedActions.map((action, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '12px 16px',
                            backgroundColor: 'var(--bg-surface)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                            flexWrap: 'wrap'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-white)', fontSize: '13px' }}>
                              {action.title}
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {action.description}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleExecuteDraftedAction(action)}
                            className="btn btn-primary btn-sm"
                          >
                            <Check size={13} /> Confirm & Execute
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="ai-message-row assistant">
                <div className="ai-message-avatar assistant">
                  <Bot size={16} />
                </div>
                <div className="ai-message-body assistant" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={14} color="var(--accent-orange)" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Querying Cindermarch telemetry and Gemini Flash intelligence...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 4.6 Chat Input Composer */}
          <div className="ai-composer-wrapper">
            <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="ai-composer-form">
              <textarea
                ref={textareaRef}
                rows={1}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask Cindermarch AI about ${activeProjectId === 'terminal-6' ? 'Terminal 6' : activeProjectId === 'blue-note-lounge' ? 'Blue Note Lounge' : 'projects'}, deadlines, bugs, canon... (Press Enter to send, Shift+Enter for newline)`}
                disabled={loading}
                className="ai-composer-input"
              />
              <button
                type="submit"
                disabled={!prompt.trim() || loading}
                className="btn btn-primary"
                style={{ padding: '10px 18px', height: '44px' }}
              >
                <Send size={15} /> Send
              </button>
            </form>
          </div>
        </div>

        {/* 4.8 Context & Telemetry Side Panel */}
        {showContextPanel && (
          <div className="ai-side-panel">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={15} color="var(--accent-orange)" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-white)' }}>
                  Studio Context
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowContextPanel(false)}
                className="btn-icon"
                style={{ color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span className="metric-label" style={{ fontSize: '10.5px' }}>Active Project Scope</span>
                <div style={{ fontWeight: 700, color: 'var(--text-white)', marginTop: '4px', fontSize: '13px' }}>
                  {activeProjectId === 'terminal-6' ? 'Terminal 6 (Psychological Horror)' : activeProjectId === 'blue-note-lounge' ? 'Blue Note Lounge (Noir Mystery)' : 'All Studio Projects'}
                </div>
              </div>

              <div>
                <span className="metric-label" style={{ fontSize: '10.5px' }}>Authenticated Operator</span>
                <div style={{ color: 'var(--text-white)', fontWeight: 600, fontSize: '12.5px', marginTop: '4px' }}>
                  {user?.displayName || 'Developer'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Roles: {user?.roles?.join(', ') || 'Developer'}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                <span className="metric-label" style={{ fontSize: '10.5px' }}>Indexed Telemetry Sources</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Tasks & Milestones</span>
                    <span className="badge badge-verified-complete" style={{ fontSize: '10px' }}>ACTIVE</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>QA Bugs & UTF Reports</span>
                    <span className="badge badge-verified-complete" style={{ fontSize: '10px' }}>ACTIVE</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Story Bible Canon</span>
                    <span className="badge badge-verified-complete" style={{ fontSize: '10px' }}>ACTIVE</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Asset Vault Metadata</span>
                    <span className="badge badge-verified-complete" style={{ fontSize: '10px' }}>ACTIVE</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Release Readiness Gates</span>
                    <span className="badge badge-verified-complete" style={{ fontSize: '10px' }}>ACTIVE</span>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                <span className="metric-label" style={{ fontSize: '10.5px' }}>Verified Integration Connectivity</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Studio Database</span>
                    <span className="badge badge-verified-complete" style={{ fontSize: '10px' }}>
                      {aiStatus?.integrations?.database?.status === 'connected' ? 'CONNECTED' : 'ACTIVE'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Plastic SCM (UVCS)</span>
                    <span className="badge" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '10px' }}>
                      {aiStatus?.integrations?.uvcs?.status === 'connected' ? 'CONNECTED' : 'MANUAL MODE'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Unity Test Framework</span>
                    <span className="badge" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--accent-orange)', fontSize: '10px' }}>
                      {aiStatus?.integrations?.unityTestRunner?.status === 'connected' ? 'ACTIVE' : 'INGESTION READY'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Unity Editor Live-link</span>
                    <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', fontSize: '10px' }}>
                      {aiStatus?.integrations?.unityEditor?.status === 'connected' ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                <span className="metric-label" style={{ fontSize: '10.5px' }}>Runtime Engine Status</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  <div>Model: <strong style={{ color: 'var(--accent-orange)' }}>{aiStatus?.model || 'cindermarch-studio-engine-v2'}</strong></div>
                  <div>Provider: <strong style={{ color: 'var(--text-white)' }}>{aiStatus?.provider || 'Authoritative Studio Engine'}</strong></div>
                  <div>Security: <strong style={{ color: 'var(--status-complete)' }}>RBAC + Double-Submit CSRF</strong></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4.9 Audit History Modal */}
      {showHistory && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={16} color="var(--accent-orange)" />
                <h3 className="modal-title">AI Query Audit History</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="btn-icon"
                style={{ color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '60vh' }}>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                  No recorded AI query sessions yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {history.map(item => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setShowHistory(false);
                        handleSend(item.prompt);
                      }}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-orange)';
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)';
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text-white)', fontSize: '12.5px' }}>
                        {item.prompt}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span className="mono">{new Date(item.created_at).toLocaleDateString()}</span>
                        <span className="mono" style={{ color: 'var(--accent-orange)' }}>{item.model_used}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
