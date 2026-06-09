// Super-admin dev tools — seed / reset / inspect.
// Exposes: window.showDevToolsDashboard()
// Visible only via the ADMIN section in Mon compte (which is already gated by super_admin).

(function () {
  async function callAdminAction(action, confirmMessage) {
    if (confirmMessage) {
      const ok = await (typeof customConfirm === 'function' ? customConfirm(confirmMessage, 'Confirmer') : Promise.resolve(confirm(confirmMessage)));
      if (!ok) return null;
    }
    showToast('Execution: ' + action + '...');
    try {
      const session = (await sb.auth.getSession()).data.session;
      if (!session) { showToast('Non connecte'); return null; }
      const r = await fetch(SUPABASE_URL + '/functions/v1/admin-dev-seed', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
      showToast('OK (' + (data.took_ms || 0) + 'ms)');
      return data;
    } catch (e) {
      console.error(action + ' error:', e);
      showToast('Erreur: ' + (e.message || e));
      return null;
    }
  }

  function fmtCounts(counts) {
    if (!counts) return '';
    return Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' · ');
  }

  async function showDevToolsDashboard() {
    let html = '<div style="padding:6px;max-width:580px;width:90vw;max-height:80vh;overflow:auto;">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">';
    html += '<div style="font-size:16px;font-weight:700;color:var(--accent);">&#129529; Dev Tools (super_admin)</div>';
    html += '<button class="btn btnSmall btnOutline" style="padding:6px 12px;font-size:11px;" onclick="closeMsg()">Fermer</button>';
    html += '</div>';

    html += '<div style="font-size:11px;color:var(--text3);margin-bottom:14px;line-height:1.5;background:rgba(108,99,255,0.08);padding:10px;border-radius:8px;border-left:3px solid var(--accent2);">';
    html += '&#9888;&#65039; Ces outils modifient ton organisation principale. Tout est trace dans audit_log.';
    html += '</div>';

    // Section: Seed
    html += '<div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px;">&#127859; Seed (cree des donnees)</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px;">';
    html += '<button onclick="window._dtSeed(\'seed_full\')" class="btn btnPrimary" style="padding:12px;font-size:12px;">&#128640; Seed complet<div style="font-size:10px;font-weight:400;opacity:0.85;margin-top:2px;">3 biens + plannings + 10 factures</div></button>';
    html += '<button onclick="window._dtSeed(\'seed_invoices\')" class="btn btnOutline" style="padding:12px;font-size:12px;">&#128196; 10 factures only</button>';
    html += '<button onclick="window._dtSeed(\'seed_plannings\')" class="btn btnOutline" style="padding:12px;font-size:12px;">&#127968; 3 biens + plannings</button>';
    html += '<button onclick="window._dtResetMyOrg()" class="btn" style="padding:12px;font-size:12px;background:#dc2626;color:#fff;border:none;">&#9888; Reset mon org</button>';
    html += '</div>';

    // Section: Audit log preview
    html += '<div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px;">&#128737; Audit log (50 dernieres entrees)</div>';
    html += '<div id="dtAuditLog" style="font-size:11px;font-family:monospace;color:var(--text3);max-height:280px;overflow:auto;background:var(--surface2);padding:10px;border-radius:6px;border:1px solid var(--border2);"></div>';

    html += '<div style="font-size:10px;color:var(--text3);text-align:center;margin-top:14px;">Lokizio v' + (window.APP_VERSION || '?') + ' · Dev tooling — non visible aux utilisateurs normaux.</div>';
    html += '</div>';
    showMsg(html, true);

    // Load audit log preview
    setTimeout(loadAuditPreview, 200);
  }

  async function loadAuditPreview() {
    const target = document.getElementById('dtAuditLog');
    if (!target) return;
    try {
      const { data, error } = await sb.from('audit_log').select('ts,action,severity,resource_type,resource_id,metadata').order('ts', { ascending: false }).limit(50);
      if (error) throw error;
      if (!data || !data.length) {
        target.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px;">Aucune entree</div>';
        return;
      }
      const colorOf = (sev) => sev === 'critical' ? '#ef4444' : (sev === 'warning' ? '#f59e0b' : 'var(--text3)');
      let h = '';
      data.forEach(r => {
        const ts = new Date(r.ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        h += '<div style="padding:4px 0;border-bottom:1px solid var(--border);">';
        h += '<span style="color:var(--text3);">' + ts + '</span> ';
        h += '<span style="color:' + colorOf(r.severity) + ';font-weight:700;">[' + r.severity + ']</span> ';
        h += '<span style="color:var(--text);">' + esc(r.action) + '</span>';
        if (r.resource_type) h += ' <span style="color:var(--text3);">' + esc(r.resource_type) + '</span>';
        if (r.metadata) h += ' <span style="color:var(--text3);opacity:0.8;">' + esc(JSON.stringify(r.metadata).slice(0, 80)) + '</span>';
        h += '</div>';
      });
      target.innerHTML = h;
    } catch (e) {
      target.innerHTML = '<div style="color:#ef4444;">Erreur: ' + esc(e.message || String(e)) + '</div>';
    }
  }

  window._dtSeed = async function (action) {
    const result = await callAdminAction(action);
    if (result?.created_counts) {
      showToast('Seed OK — ' + fmtCounts(result.created_counts));
      setTimeout(loadAuditPreview, 800);
    }
  };

  window._dtResetMyOrg = async function () {
    const result = await callAdminAction('reset_my_org', 'ATTENTION : ceci va SUPPRIMER toutes les properties, factures, plannings, service_requests, cleaning_validations de ton org. Les members et organisation eux-memes restent.\n\nContinue ?');
    if (result?.reset) {
      showToast('Org reset OK — ' + (Object.keys(result.deleted || {}).length) + ' tables videes');
      setTimeout(loadAuditPreview, 800);
    }
  };

  window.showDevToolsDashboard = showDevToolsDashboard;
})();
