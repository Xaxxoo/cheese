'use client';

import { useState } from 'react';
import { c } from '../_shared';
import {
  broadcastLaunchPreview,
  broadcastLaunchSend,
  type BroadcastResult,
} from '@/lib/api/admin';

export default function BroadcastPage() {
  const [limit,       setLimit]       = useState(50);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [sendBusy,    setSendBusy]    = useState(false);
  const [result,      setResult]      = useState<BroadcastResult | null>(null);
  const [previewDone, setPreviewDone] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handlePreview() {
    setPreviewBusy(true);
    setError(null);
    try {
      await broadcastLaunchPreview();
      setPreviewDone(true);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Preview failed');
    } finally {
      setPreviewBusy(false);
    }
  }

  async function handleSend() {
    setSendBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await broadcastLaunchSend(limit);
      setResult(res);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Send failed');
    } finally {
      setSendBusy(false);
    }
  }

  return (
    <div style={{ padding: '32px 32px', maxWidth: 680, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: c.text, margin: '0 0 6px', letterSpacing: '-0.4px' }}>
          Broadcast
        </h1>
        <p style={{ fontSize: 13, color: c.textDim, margin: 0, lineHeight: 1.6 }}>
          Send the "we're live" email to waitlist users. Always send a preview first.
          Sent entries are marked Notified automatically — re-running picks up the remainder.
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        padding: '28px 28px',
      }}>

        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.textDim, marginBottom: 20 }}>
          Waitlist Launch Email
        </div>

        {/* Step 1 — preview */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 6 }}>
            Step 1 — Preview
          </div>
          <p style={{ fontSize: 12.5, color: c.textDim, margin: '0 0 14px', lineHeight: 1.6 }}>
            Sends the email to <strong style={{ color: c.textMid }}>bnahmad83@gmail.com</strong> so you can approve it before the real send.
          </p>
          <button
            onClick={handlePreview}
            disabled={previewBusy}
            style={{
              fontSize: 13, fontWeight: 600, padding: '9px 20px',
              borderRadius: 8, border: `1px solid ${c.border}`,
              background: previewDone ? c.greenDim : 'rgba(255,255,255,0.06)',
              color: previewDone ? c.green : c.text,
              cursor: previewBusy ? 'not-allowed' : 'pointer',
              opacity: previewBusy ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {previewBusy ? 'Sending…' : previewDone ? '✓ Preview sent' : 'Send preview'}
          </button>
        </div>

        <div style={{ height: 1, background: c.border, marginBottom: 24 }} />

        {/* Step 2 — send */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 6 }}>
            Step 2 — Send batch
          </div>
          <p style={{ fontSize: 12.5, color: c.textDim, margin: '0 0 16px', lineHeight: 1.6 }}>
            Sends to the next <em>N</em> PENDING waitlist users (oldest first).
            Run again tomorrow to send the next batch.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <label style={{ fontSize: 12.5, color: c.textMid, whiteSpace: 'nowrap' }}>Batch size</label>
            <input
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(e) => setLimit(Math.min(100, Math.max(1, Number(e.target.value))))}
              style={{
                width: 80, padding: '7px 10px', borderRadius: 7,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${c.border}`,
                color: c.text, fontSize: 13, fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: 12, color: c.textDim }}>max 100 (Resend daily limit)</span>
          </div>

          <button
            onClick={handleSend}
            disabled={sendBusy}
            style={{
              fontSize: 13, fontWeight: 600, padding: '9px 22px',
              borderRadius: 8, border: 'none',
              background: c.amber,
              color: '#09090b',
              cursor: sendBusy ? 'not-allowed' : 'pointer',
              opacity: sendBusy ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {sendBusy ? 'Sending…' : `Send to ${limit} users`}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 20, padding: '14px 18px', borderRadius: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 13, color: c.red,
        }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{
          marginTop: 20, padding: '18px 22px', borderRadius: 12,
          background: c.greenDim, border: '1px solid rgba(34,197,94,0.2)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.green, marginBottom: 10 }}>
            Broadcast complete
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.green }}>{result.sent}</div>
              <div style={{ fontSize: 11, color: c.textDim, marginTop: 2 }}>Sent</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: result.failed > 0 ? c.red : c.textDim }}>{result.failed}</div>
              <div style={{ fontSize: 11, color: c.textDim, marginTop: 2 }}>Failed</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.textMid }}>{result.total}</div>
              <div style={{ fontSize: 11, color: c.textDim, marginTop: 2 }}>In batch</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: c.red, marginBottom: 6 }}>Failures</div>
              {result.errors.map((e, i) => (
                <div key={i} style={{ fontSize: 11.5, color: c.textDim, marginBottom: 3 }}>{e}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
