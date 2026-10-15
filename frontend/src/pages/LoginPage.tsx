import React, { useState, useEffect } from 'react';
import { Shield, KeyRound, AlertCircle, UserPlus, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';

export const LoginPage: React.FC = () => {
  const { login, signup, isLoading } = useAuth();
  const [tab, setTab] = useState<'login' | 'signup'>('login');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('lead');
  const [loginPassword, setLoginPassword] = useState('Terminal6#Studio');

  // Signup form state
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupDisplayName, setSignupDisplayName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [invitationToken, setInvitationToken] = useState('');
  const [inviteDetails, setInviteDetails] = useState<{
    workspaceName: string;
    invitedByName: string;
    email: string;
    role: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check URL query param for invite token on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite');
    if (inviteParam) {
      setInvitationToken(inviteParam);
      setTab('signup');
      verifyInviteToken(inviteParam);
    }
  }, []);

  const verifyInviteToken = async (token: string) => {
    try {
      const data = await apiRequest(`/api/auth/invitations/verify/${token}`);
      if (data.valid) {
        setInviteDetails({
          workspaceName: data.workspaceName,
          invitedByName: data.invitedByName,
          email: data.email,
          role: data.role
        });
        if (data.email) setSignupEmail(data.email);
      }
    } catch (err: any) {
      setError(`Invitation check failed: ${err.message}`);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    try {
      await login(loginUsername, loginPassword);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    try {
      await signup({
        username: signupUsername,
        email: signupEmail,
        displayName: signupDisplayName,
        password: signupPassword,
        invitationToken: invitationToken.trim() || undefined
      });
      setSuccessMessage('Account registered successfully! Welcome to Cindermarch Hub.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleQuickSelect = (userKey: string) => {
    setLoginUsername(userKey);
    setLoginPassword('Terminal6#Studio');
    setError(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-black)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '36px 32px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.85)'
        }}
      >
        {/* Studio Branding & Official Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px'
            }}
          >
            <img
              src="/cindermarch-logo.png"
              alt="Cindermarch Studio Logo"
              style={{
                height: '76px',
                width: 'auto',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 16px rgba(255, 106, 0, 0.35))'
              }}
            />
          </div>

          <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '1px', color: 'var(--text-white)' }}>
            CINDERMARCH ENGINE HUB
          </h1>
          <div className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            TERMINAL 6 // MULTI-USER WORKSPACE
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-elevated)',
            padding: '4px',
            borderRadius: '6px',
            marginBottom: '20px'
          }}
        >
          <button
            type="button"
            onClick={() => { setTab('login'); setError(null); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: tab === 'login' ? 'var(--accent-orange)' : 'transparent',
              color: tab === 'login' ? '#080808' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setError(null); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: tab === 'signup' ? 'var(--accent-orange)' : 'transparent',
              color: tab === 'signup' ? '#080808' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '20px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success" style={{ marginBottom: '20px' }}>
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {inviteDetails && tab === 'signup' && (
          <div
            style={{
              backgroundColor: 'rgba(255, 106, 0, 0.1)',
              border: '1px solid rgba(255, 106, 0, 0.3)',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '18px',
              fontSize: '12px'
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--accent-orange)', marginBottom: '4px' }}>
              Workspace Invitation Detected
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              Invited by <strong style={{ color: 'var(--text-white)' }}>{inviteDetails.invitedByName}</strong> to join{' '}
              <strong style={{ color: 'var(--text-white)' }}>{inviteDetails.workspaceName}</strong> as a{' '}
              <strong style={{ color: 'var(--accent-orange)' }}>{inviteDetails.role}</strong>.
            </div>
          </div>
        )}

        {tab === 'login' ? (
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label">Studio Username or Email</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. lead, yehia, joe"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', height: '42px', fontSize: '14px' }}
              disabled={isLoading}
            >
              <KeyRound size={16} />
              {isLoading ? 'Authenticating...' : 'Sign In to Hub'}
            </button>

            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '18px' }}>
              <div
                className="mono"
                style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px', textAlign: 'center' }}
              >
                TEAM DEV PROFILES
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    fontSize: '11px',
                    padding: '8px 4px',
                    justifyContent: 'center',
                    borderColor: loginUsername === 'lead' ? 'var(--accent-orange)' : undefined
                  }}
                  onClick={() => handleQuickSelect('lead')}
                >
                  Engine Lead
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    fontSize: '11px',
                    padding: '8px 4px',
                    justifyContent: 'center',
                    borderColor: loginUsername === 'yehia' ? 'var(--accent-orange)' : undefined
                  }}
                  onClick={() => handleQuickSelect('yehia')}
                >
                  Yehia (Dev)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    fontSize: '11px',
                    padding: '8px 4px',
                    justifyContent: 'center',
                    borderColor: loginUsername === 'joe' ? 'var(--accent-orange)' : undefined
                  }}
                  onClick={() => handleQuickSelect('joe')}
                >
                  Joe (Dev)
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignupSubmit}>
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Yehia Ibrahim"
                value={signupDisplayName}
                onChange={(e) => setSignupDisplayName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. yehia"
                value={signupUsername}
                onChange={(e) => setSignupUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="developer@cindermarch.studio"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password (min 6 characters)</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">
                Invitation Token <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. inv_..."
                value={invitationToken}
                onChange={(e) => {
                  setInvitationToken(e.target.value);
                  if (e.target.value.length > 10) verifyInviteToken(e.target.value);
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                Join Cindermarch Studio workspace if invited by the Engine Lead.
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', height: '42px', fontSize: '14px' }}
              disabled={isLoading}
            >
              <UserPlus size={16} />
              {isLoading ? 'Creating Account...' : 'Register & Join Studio'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
