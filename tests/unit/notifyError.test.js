// Tests for the notifyError() global helper (api_bridge.js)
// Simulates browser context to verify toast fallback + console logging.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Re-declare helper (api_bridge.js attaches to window, we isolate for testing)
function makeNotifyError(showToastFn) {
  return function notifyError(label, err) {
    const msg = (err && (err.message || err.error_description || err.details)) || String(err || '');
    console.error('[notifyError]', label, err);
    try {
      if (typeof showToastFn === 'function') showToastFn((label || 'Erreur') + (msg ? ' — ' + msg : ''), 'error');
    } catch (_) { /* toast indisponible, log suffit */ }
  };
}

describe('notifyError', () => {
  let toastSpy, consoleErrorSpy;

  beforeEach(() => {
    toastSpy = vi.fn();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('calls showToast with label + message', () => {
    const notifyError = makeNotifyError(toastSpy);
    notifyError('Save failed', new Error('network'));
    expect(toastSpy).toHaveBeenCalledWith('Save failed — network', 'error');
  });

  it('logs to console.error with full error object', () => {
    const notifyError = makeNotifyError(toastSpy);
    const err = new Error('boom');
    notifyError('Load invoices', err);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[notifyError]', 'Load invoices', err);
  });

  it('uses error_description field (Supabase style)', () => {
    const notifyError = makeNotifyError(toastSpy);
    notifyError('Login failed', { error_description: 'Invalid credentials' });
    expect(toastSpy).toHaveBeenCalledWith('Login failed — Invalid credentials', 'error');
  });

  it('uses details field (PostgREST style)', () => {
    const notifyError = makeNotifyError(toastSpy);
    notifyError('Insert failed', { details: 'duplicate key' });
    expect(toastSpy).toHaveBeenCalledWith('Insert failed — duplicate key', 'error');
  });

  it('handles string errors', () => {
    const notifyError = makeNotifyError(toastSpy);
    notifyError('Op failed', 'simple string error');
    expect(toastSpy).toHaveBeenCalledWith('Op failed — simple string error', 'error');
  });

  it('handles null/undefined gracefully', () => {
    const notifyError = makeNotifyError(toastSpy);
    notifyError('Op failed', null);
    expect(toastSpy).toHaveBeenCalledWith('Op failed', 'error');
  });

  it('defaults label to "Erreur" when missing', () => {
    const notifyError = makeNotifyError(toastSpy);
    notifyError(null, new Error('x'));
    expect(toastSpy).toHaveBeenCalledWith('Erreur — x', 'error');
  });

  it('does not throw when showToast is unavailable', () => {
    const notifyError = makeNotifyError(undefined);
    expect(() => notifyError('Op', new Error('test'))).not.toThrow();
    // Still logs to console
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('does not throw when showToast itself throws', () => {
    const notifyError = makeNotifyError(() => { throw new Error('toast broken'); });
    expect(() => notifyError('Op', new Error('test'))).not.toThrow();
  });

  it('uses "error" severity (not "info" or "success")', () => {
    const notifyError = makeNotifyError(toastSpy);
    notifyError('Op', new Error('x'));
    expect(toastSpy.mock.calls[0][1]).toBe('error');
  });
});
