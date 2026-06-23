/**
 * CheesePay Merchant SDK — Veil Private Gateway
 *
 * Usage:
 *   <script src="/sdk.js" data-cheese-sdk data-api-base="https://api.cheesepay.xyz"></script>
 *
 *   const result = await window.CheesePay.requestPayment({
 *     amount: 10,                             // USDC
 *     merchantId: 'my-merchant-id',
 *     merchantName: 'My Store',
 *     settlementBankCode: '058',
 *     settlementAccountNumber: '0123456789',
 *     settlementBankName: 'GTBank',
 *     settlementAccountName: 'JOHN DOE',
 *     apiKey: 'optional-api-key',
 *     callbackUrl: 'https://yoursite.com/webhook',
 *   });
 *   console.log('Settled:', result);
 */
(function (global) {
  'use strict';

  function detectApiBase() {
    var tags = document.querySelectorAll('script[data-cheese-sdk]');
    if (tags.length) {
      return tags[tags.length - 1].getAttribute('data-api-base') || '';
    }
    return '';
  }

  function loadQrLibrary(cb) {
    if (global.QRCode) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = cb;
    s.onerror = function () { cb(); }; // graceful — QR just won't render
    document.head.appendChild(s);
  }

  function el(tag, style, html) {
    var e = document.createElement(tag);
    if (style) e.style.cssText = style;
    if (html) e.innerHTML = html;
    return e;
  }

  function showModal(invoice, apiBase, onSettled, onError) {
    var qrPayload = [
      'cheese://pay',
      '?ref=', encodeURIComponent(invoice.reference),
      '&addr=', encodeURIComponent(invoice.receivingAddress),
      '&amount=', invoice.amountUsdc,
    ].join('');

    var overlay = el('div', [
      'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647',
      'background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    ].join(';'));

    var box = el('div', [
      'background:#fff;border-radius:20px;padding:32px 28px;max-width:360px;width:90%',
      'text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.36)',
    ].join(';'), [
      '<h2 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#111">Veil Private Payment</h2>',
      '<p style="margin:0 0 20px;font-size:13px;color:#888">Pay from your shielded Veil balance</p>',
      '<div style="margin:0 0 16px;padding:14px;background:#f7f7f7;border-radius:12px">',
        '<div style="font-size:28px;font-weight:800;color:#111;letter-spacing:-1px">',
          invoice.amountUsdc, ' <span style="font-size:16px;font-weight:500;color:#555">USDC</span>',
        '</div>',
        '<div style="font-size:13px;color:#888;margin-top:4px">to ' + escapeHtml(invoice.merchantName) + '</div>',
      '</div>',
      '<div id="cheese-qr-container" style="margin:0 auto 16px;display:flex;justify-content:center;min-height:180px;align-items:center">',
        '<span style="color:#ccc;font-size:13px">Loading QR…</span>',
      '</div>',
      '<p style="margin:0 0 6px;font-size:11px;color:#bbb;font-family:monospace;word-break:break-all">',
        escapeHtml(invoice.reference),
      '</p>',
      '<p id="cheese-status-text" style="margin:0 0 20px;font-size:14px;color:#666">Waiting for payment…</p>',
      '<button id="cheese-cancel-btn" style="',
        'border:1px solid #e0e0e0;background:#fff;padding:11px 28px;border-radius:10px',
        ';cursor:pointer;font-size:14px;color:#555;transition:background 0.15s',
      '">Cancel</button>',
    ].join(''));

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var pollInterval;

    function cleanup() {
      clearInterval(pollInterval);
      if (overlay.parentNode) document.body.removeChild(overlay);
    }

    document.getElementById('cheese-cancel-btn').onclick = function () {
      cleanup();
      onError(new Error('Payment cancelled by user'));
    };

    loadQrLibrary(function () {
      var container = document.getElementById('cheese-qr-container');
      if (!container) return;
      container.innerHTML = '';
      if (global.QRCode) {
        new global.QRCode(container, {
          text: qrPayload,
          width: 180,
          height: 180,
          colorDark: '#111111',
          colorLight: '#ffffff',
          correctLevel: global.QRCode.CorrectLevel.M,
        });
      } else {
        container.innerHTML = '<span style="font-size:12px;color:#aaa">QR unavailable — use ref above</span>';
      }
    });

    pollInterval = setInterval(function () {
      var headers = { 'Content-Type': 'application/json' };
      if (invoice._apiKey) headers['X-Api-Key'] = invoice._apiKey;

      fetch(apiBase + '/private-gateway/invoice/' + encodeURIComponent(invoice.reference) + '/status', { headers: headers })
        .then(function (r) { return r.json(); })
        .then(function (body) {
          var data = body.data || body;
          var status = data.status;

          var statusEl = document.getElementById('cheese-status-text');
          if (statusEl) {
            statusEl.textContent =
              status === 'settled'  ? 'Payment received!' :
              status === 'settling' ? 'Settling to bank…' :
              status === 'paid'     ? 'Payment confirmed — settling…' :
              status === 'failed'   ? 'Payment failed.' :
              status === 'expired'  ? 'Invoice expired.' :
              'Waiting for payment…';
            statusEl.style.color =
              status === 'settled' ? '#22c55e' :
              status === 'failed' || status === 'expired' ? '#ef4444' : '#666';
          }

          if (status === 'settled') {
            clearInterval(pollInterval);
            setTimeout(function () { cleanup(); }, 1800);
            onSettled(data);
          } else if (status === 'failed' || status === 'expired') {
            clearInterval(pollInterval);
            setTimeout(function () { cleanup(); }, 2500);
            onError(new Error('Invoice ' + status));
          }
        })
        .catch(function () {}); // swallow transient network errors
    }, 3000);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  global.CheesePay = {
    /**
     * Open the payment modal and return a promise that resolves with the
     * settled invoice data, or rejects on cancel / failure.
     *
     * @param {object} opts
     * @param {number}  opts.amount                   - Amount in USDC
     * @param {string}  opts.merchantId               - Your merchant identifier
     * @param {string}  opts.merchantName             - Display name in modal
     * @param {string}  opts.settlementBankCode        - Bank sort code (e.g. '058')
     * @param {string}  opts.settlementAccountNumber   - Your NGN account number
     * @param {string}  opts.settlementBankName        - Full bank name
     * @param {string}  opts.settlementAccountName     - Account holder name
     * @param {string}  [opts.apiKey]                 - X-Api-Key if required
     * @param {string}  [opts.callbackUrl]             - Webhook URL for status changes
     * @param {number}  [opts.expiresInMinutes=60]     - Invoice TTL (1–1440)
     * @returns {Promise<object>} Resolved with settled invoice data
     */
    requestPayment: function (opts) {
      return new Promise(function (resolve, reject) {
        var apiBase = detectApiBase();

        var headers = { 'Content-Type': 'application/json' };
        if (opts.apiKey) headers['X-Api-Key'] = opts.apiKey;

        fetch(apiBase + '/private-gateway/invoice', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            amountUsdc: opts.amount,
            merchantId: opts.merchantId,
            merchantName: opts.merchantName || opts.merchantId,
            settlementBankCode: opts.settlementBankCode,
            settlementAccountNumber: opts.settlementAccountNumber,
            settlementBankName: opts.settlementBankName,
            settlementAccountName: opts.settlementAccountName,
            callbackUrl: opts.callbackUrl || undefined,
            expiresInMinutes: opts.expiresInMinutes || undefined,
          }),
        })
          .then(function (r) {
            if (!r.ok) throw new Error('Failed to create invoice (' + r.status + ')');
            return r.json();
          })
          .then(function (body) {
            var invoice = body.data || body;
            invoice._apiKey = opts.apiKey;
            showModal(invoice, apiBase, resolve, reject);
          })
          .catch(reject);
      });
    },
  };
})(window);
