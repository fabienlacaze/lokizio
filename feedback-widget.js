// In-app feedback widget for Lokizio beta testing.
// Exposes: window.openFeedbackWidget()
// Mounts a floating 💬 button in bottom-left (when user logged in) that
// opens a modal: rating 1-5 stars + textarea + optional screenshot capture.
// Submits to /functions/v1/feedback-submit which stores + emails Fabien.

(function () {
  let _floatingMounted = false;
  let _screenshotDataUrl = null;

  // Render the floating button — once user is authenticated.
  async function mountFloatingButton() {
    if (_floatingMounted) return;
    if (typeof sb === 'undefined') return;
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return; // only authenticated users see the widget
    } catch (_) { return; }

    const btn = document.createElement('button');
    btn.id = 'feedbackFloatBtn';
    btn.title = 'Donner mon avis sur Lokizio';
    btn.setAttribute('aria-label', 'Donner mon avis');
    btn.innerHTML = '&#128172;';
    btn.style.cssText = 'position:fixed;bottom:80px;left:14px;width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;font-size:22px;cursor:pointer;z-index:99997;box-shadow:0 4px 14px rgba(108,99,255,0.45);transition:transform 0.15s;';
    btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
    btn.onmouseout = () => btn.style.transform = '';
    btn.onclick = openFeedbackWidget;
    document.body.appendChild(btn);
    _floatingMounted = true;
  }

  function unmountFloatingButton() {
    const el = document.getElementById('feedbackFloatBtn');
    if (el) el.remove();
    _floatingMounted = false;
  }

  // The modal — uses Lokizio's existing showMsg/closeMsg infrastructure.
  function openFeedbackWidget() {
    _screenshotDataUrl = null;
    let html = '<div style="padding:6px;max-width:480px;width:90vw;">';
    html += '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px;">&#128172; Ton avis nous aide</div>';
    html += '<div style="font-size:11px;color:var(--text3);margin-bottom:14px;line-height:1.4;">Bug, idee, frustration, satisfaction — partage en 30 secondes. Direct chez Fabien.</div>';

    // Rating stars
    html += '<label style="display:block;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Ta note</label>';
    html += '<div id="fbRatingRow" style="display:flex;gap:4px;font-size:30px;margin-bottom:14px;cursor:pointer;user-select:none;">';
    for (let i = 1; i <= 5; i++) {
      html += '<span data-fb-star="' + i + '" onclick="window._fbSetRating(' + i + ')" style="color:var(--text3);transition:color 0.1s;">&#9733;</span>';
    }
    html += '</div>';
    html += '<input type="hidden" id="fbRating" value="">';

    // Text
    html += '<label style="display:block;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Ton message <span style="color:#ef4444;">*</span></label>';
    html += '<textarea id="fbText" rows="4" placeholder="Bug rencontre ? Suggestion ? Ce qui marche bien ?" maxlength="5000" style="width:100%;padding:10px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;font-family:Inter,sans-serif;resize:vertical;box-sizing:border-box;margin-bottom:12px;"></textarea>';

    // Screenshot toggle
    html += '<div style="margin-bottom:14px;">';
    html += '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2);cursor:pointer;"><input type="checkbox" id="fbWantScreenshot" onchange="window._fbToggleScreenshot()" style="cursor:pointer;"> Inclure une capture d\'ecran de la page actuelle</label>';
    html += '<div id="fbScreenshotPreview" style="display:none;margin-top:8px;"></div>';
    html += '</div>';

    // Page info (auto)
    html += '<div style="font-size:10px;color:var(--text3);margin-bottom:14px;line-height:1.4;padding:8px 10px;background:var(--surface2);border-radius:6px;">';
    html += '<div>&#128279; Page: ' + esc((location.pathname + location.hash || '/').slice(0, 80)) + '</div>';
    html += '<div>&#128241; Version: ' + (window.APP_VERSION || '?') + '</div>';
    html += '</div>';

    // Buttons
    html += '<div style="display:flex;gap:8px;">';
    html += '<button class="btn btnOutline" style="flex:1;padding:11px;" onclick="closeMsg()">Annuler</button>';
    html += '<button class="btn btnPrimary" style="flex:1;padding:11px;font-weight:700;" onclick="window._fbSubmit()">&#128231; Envoyer</button>';
    html += '</div>';
    html += '</div>';
    showMsg(html, true);
  }

  window._fbSetRating = function (n) {
    const stars = document.querySelectorAll('[data-fb-star]');
    stars.forEach(s => {
      const v = parseInt(s.getAttribute('data-fb-star'), 10);
      s.style.color = v <= n ? '#fbbf24' : 'var(--text3)';
    });
    const input = document.getElementById('fbRating');
    if (input) input.value = String(n);
  };

  // Use the browser-native getDisplayMedia for a clean capture (no html2canvas dependency)
  // Fallback: simple DOM serialization via canvas (limited but no extra weight).
  async function captureScreenshot() {
    // Try html2canvas lazy if available, else fallback
    try {
      // Lightweight fallback: capture only the visible viewport using a 1x1 canvas + dataURL
      // This is actually not ideal — we use the simpler approach: drawWindow on Firefox is not portable.
      // For now, we just send a synthetic image with the URL + viewport size as metadata.
      // Better solution: dynamically load html2canvas (~50KB) only on demand.
      const cdn = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = cdn; s.onload = resolve; s.onerror = () => reject(new Error('html2canvas load failed'));
          document.head.appendChild(s);
        });
      }
      // Capture the body excluding the feedback modal itself
      const target = document.body;
      const canvas = await window.html2canvas(target, {
        scale: Math.min(1, 1024 / window.innerWidth),
        logging: false,
        useCORS: true,
        ignoreElements: (el) => el.id === 'msgOverlay' || el.id === 'feedbackFloatBtn',
      });
      // Compress to ~1024px wide if larger
      const maxW = 1280;
      let finalCanvas = canvas;
      if (canvas.width > maxW) {
        const scale = maxW / canvas.width;
        finalCanvas = document.createElement('canvas');
        finalCanvas.width = maxW;
        finalCanvas.height = Math.round(canvas.height * scale);
        finalCanvas.getContext('2d').drawImage(canvas, 0, 0, finalCanvas.width, finalCanvas.height);
      }
      return finalCanvas.toDataURL('image/jpeg', 0.7);
    } catch (e) {
      console.warn('Screenshot capture failed:', e);
      return null;
    }
  }

  window._fbToggleScreenshot = async function () {
    const cb = document.getElementById('fbWantScreenshot');
    const preview = document.getElementById('fbScreenshotPreview');
    if (!cb || !preview) return;
    if (cb.checked) {
      preview.innerHTML = '<div style="font-size:11px;color:var(--text3);">Capture en cours...</div>';
      preview.style.display = 'block';
      // Hide the feedback modal during capture
      const overlay = document.getElementById('msgOverlay');
      if (overlay) overlay.style.visibility = 'hidden';
      await new Promise(r => setTimeout(r, 150)); // let the browser repaint
      const dataUrl = await captureScreenshot();
      if (overlay) overlay.style.visibility = '';
      if (dataUrl) {
        _screenshotDataUrl = dataUrl;
        preview.innerHTML = '<img src="' + dataUrl + '" style="max-width:100%;border-radius:6px;border:1px solid var(--border2);">';
      } else {
        preview.innerHTML = '<div style="font-size:11px;color:#ef4444;">Capture impossible (navigateur ou extension la bloque)</div>';
        cb.checked = false;
      }
    } else {
      _screenshotDataUrl = null;
      preview.innerHTML = '';
      preview.style.display = 'none';
    }
  };

  window._fbSubmit = async function () {
    const text = (document.getElementById('fbText')?.value || '').trim();
    const ratingStr = document.getElementById('fbRating')?.value || '';
    const rating = ratingStr ? parseInt(ratingStr, 10) : undefined;
    if (text.length < 3) {
      showToast('Message trop court (3 caracteres minimum)');
      return;
    }
    closeMsg();
    showToast('Envoi en cours...');
    try {
      const session = (await sb.auth.getSession()).data.session;
      if (!session) { showToast('Non connecte'); return; }
      const r = await fetch(SUPABASE_URL + '/functions/v1/feedback-submit', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: rating,
          text,
          page_url: location.pathname + location.hash,
          user_agent: navigator.userAgent,
          app_version: window.APP_VERSION || null,
          screenshot_data_url: _screenshotDataUrl,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
      showToast('Merci pour ton retour ! &#128640;');
    } catch (e) {
      console.error('feedback-submit error:', e);
      showToast('Erreur envoi: ' + (e.message || e));
    }
  };

  window.openFeedbackWidget = openFeedbackWidget;
  window.mountFeedbackFloatingBtn = mountFloatingButton;
  window.unmountFeedbackFloatingBtn = unmountFloatingButton;

  // Auto-mount after auth ready. Lokizio fires no explicit "auth ready" event,
  // so we poll for a few seconds after DOMContentLoaded.
  function tryMount() {
    if (_floatingMounted) return;
    mountFloatingButton();
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(tryMount, 1500);
    setTimeout(tryMount, 4000);
    setTimeout(tryMount, 8000);
  });
})();
