// Sentry dashboard — admin-only view of the latest production errors.
// Calls the sentry-issues Edge Function which checks super_admin membership.
// Module exposes window.showSentryDashboard().

(function () {
  async function fetchSentryIssues(opts) {
    const params = new URLSearchParams();
    if (opts && opts.all) params.set('all', '1');
    if (opts && opts.limit) params.set('limit', String(opts.limit));
    if (opts && opts.issue) params.set('issue', opts.issue);
    const session = (await sb.auth.getSession()).data.session;
    if (!session) throw new Error('Pas de session');
    const r = await fetch(SUPABASE_URL + '/functions/v1/sentry-issues?' + params.toString(), {
      headers: { Authorization: 'Bearer ' + session.access_token },
    });
    if (r.status === 403) throw new Error('Acces reserve aux super admins');
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return r.json();
  }

  function fmtDate(s) {
    if (!s) return '';
    return new Date(s).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function impactColor(level) {
    return level === 'error' ? '#e94560' : level === 'warning' ? '#f59e0b' : '#6c63ff';
  }

  async function showSentryDashboard() {
    let html = '<div style="padding:6px;max-height:78vh;overflow-y:auto;">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;">';
    html += '<div style="font-size:16px;font-weight:700;">&#128270; Sentry — Issues recentes</div>';
    html += '<button class="btn btnSmall btnOutline" style="padding:6px 12px;font-size:11px;" onclick="showSentryDashboard()">&#x21bb; Refresh</button>';
    html += '</div>';
    html += '<div id="sentryListBody" style="font-size:12px;">Chargement...</div>';
    html += '</div>';
    showMsg(html, true);

    try {
      const { issues } = await fetchSentryIssues({ limit: 20 });
      const body = document.getElementById('sentryListBody');
      if (!body) return;
      if (!issues || !issues.length) {
        body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text3);">&#10003; Aucune erreur recente. <br><span style="font-size:11px;">Tu peux dormir tranquille.</span></div>';
        return;
      }
      const rows = issues.map((i) => {
        const color = impactColor(i.level);
        const title = (i.title || i.metadata?.value || '(sans titre)').slice(0, 90);
        const seen = fmtDate(i.lastSeen);
        return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px;cursor:pointer;" onclick="showSentryIssue('${i.shortId}')">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;">
            <span style="display:inline-block;padding:2px 8px;background:${color}22;color:${color};border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;">${i.level || '?'}</span>
            <span style="font-size:10px;color:var(--text3);">${i.shortId}</span>
          </div>
          <div style="color:var(--text);font-weight:500;line-height:1.4;margin-bottom:4px;">${_escHtml ? _escHtml(title) : title}</div>
          <div style="display:flex;justify-content:space-between;color:var(--text3);font-size:11px;">
            <span>${i.count} events &middot; ${i.userCount} user(s)</span>
            <span>${seen}</span>
          </div>
        </div>`;
      }).join('');
      body.innerHTML = rows;
    } catch (e) {
      const body = document.getElementById('sentryListBody');
      if (body) body.innerHTML = '<div style="color:var(--danger);padding:14px;">Erreur: ' + (e.message || e) + '</div>';
    }
  }

  async function showSentryIssue(shortId) {
    let html = '<div style="padding:6px;max-height:78vh;overflow-y:auto;">';
    html += '<button class="btn btnSmall btnOutline" style="padding:6px 12px;font-size:11px;margin-bottom:10px;" onclick="showSentryDashboard()">&#x2190; Retour liste</button>';
    html += '<div id="sentryIssueBody" style="font-size:12px;">Chargement...</div>';
    html += '</div>';
    showMsg(html, true);

    try {
      const { issue, lastEvent } = await fetchSentryIssues({ issue: shortId });
      const body = document.getElementById('sentryIssueBody');
      if (!body) return;
      const exc = lastEvent && lastEvent.entries && lastEvent.entries.find((e) => e.type === 'exception');
      const value = exc && exc.data && exc.data.values && exc.data.values[0];
      const frames = (value && value.stacktrace && value.stacktrace.frames || []).slice(-8);
      const breadcrumbs = lastEvent && lastEvent.entries && lastEvent.entries.find((e) => e.type === 'breadcrumbs');
      const breadcrumbsList = (breadcrumbs && breadcrumbs.data && breadcrumbs.data.values || []).slice(-8);

      let h = '';
      h += `<div style="margin-bottom:14px;">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px;">${_escHtml ? _escHtml(issue.title || '?') : issue.title}</div>
        <div style="font-size:11px;color:var(--text3);">${issue.shortId} &middot; ${issue.count} events &middot; ${issue.userCount} user(s)</div>
        <div style="font-size:11px;color:var(--text3);">First seen ${fmtDate(issue.firstSeen)} &middot; Last seen ${fmtDate(issue.lastSeen)}</div>
        <a href="${issue.permalink}" target="_blank" style="color:var(--accent2);font-size:11px;">Ouvrir dans Sentry &#8599;</a>
      </div>`;
      if (value) {
        h += '<div style="background:var(--surface2);border-radius:8px;padding:10px;margin-bottom:10px;font-family:monospace;font-size:11px;">';
        h += '<div style="color:var(--danger);margin-bottom:8px;font-weight:700;">' + (value.type || '?') + ': ' + (_escHtml ? _escHtml(value.value || '') : value.value) + '</div>';
        frames.forEach((f) => {
          h += '<div style="color:var(--text2);margin-left:8px;">at ' + (f.function || '?') + ' (' + (f.filename || '?') + ':' + (f.lineNo || '?') + ')</div>';
        });
        h += '</div>';
      }
      if (breadcrumbsList.length) {
        h += '<div style="font-size:11px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Actions precedentes (breadcrumbs)</div>';
        h += '<div style="background:var(--surface2);border-radius:8px;padding:10px;font-family:monospace;font-size:10px;line-height:1.5;">';
        breadcrumbsList.forEach((b) => {
          h += '<div style="color:var(--text2);">[' + (b.category || '?') + '] ' + (b.message ? (_escHtml ? _escHtml(b.message) : b.message).slice(0, 200) : '') + '</div>';
        });
        h += '</div>';
      }
      body.innerHTML = h;
    } catch (e) {
      const body = document.getElementById('sentryIssueBody');
      if (body) body.innerHTML = '<div style="color:var(--danger);padding:14px;">Erreur: ' + (e.message || e) + '</div>';
    }
  }

  window.showSentryDashboard = showSentryDashboard;
  window.showSentryIssue = showSentryIssue;
})();
