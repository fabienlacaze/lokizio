// Admin dashboard for Lokizio Stripe Connect revenue (super_admin only).
// Exposed: window.showStripeAdminDashboard()
// Hidden behind the same gate as the Sentry dashboard (Mon compte > ADMIN).

(function () {
  function fmt(cents) {
    return (cents / 100).toFixed(2) + ' €';
  }

  function monthLabel(yyyymm) {
    const [y, m] = yyyymm.split('-');
    const months = ['Janv.', 'Fevr.', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil.', 'Aout', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
    return months[parseInt(m, 10) - 1] + ' ' + y;
  }

  async function showStripeAdminDashboard() {
    showToast('Chargement stats Stripe Connect...');
    try {
      const session = (await sb.auth.getSession()).data.session;
      if (!session) { showToast('Non connecte'); return; }
      const r = await fetch(SUPABASE_URL + '/functions/v1/stripe-admin-stats', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);

      let html = '<div style="padding:6px;max-width:680px;width:90vw;max-height:80vh;overflow:auto;">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">';
      html += '<div style="font-size:16px;font-weight:700;color:var(--accent);">&#128202; Stripe Connect — Revenus Lokizio</div>';
      html += '<button class="btn btnSmall btnOutline" style="padding:6px 12px;font-size:11px;" onclick="closeMsg()">Fermer</button>';
      html += '</div>';

      // KPIs
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px;">';
      html += '<div style="padding:14px;background:rgba(108,99,255,0.08);border-radius:8px;text-align:center;">';
      html += '<div style="font-size:11px;color:var(--text3);">Transactions</div>';
      html += '<div style="font-size:22px;font-weight:800;color:var(--accent);">' + data.total_count + '</div>';
      html += '</div>';
      html += '<div style="padding:14px;background:rgba(52,211,153,0.08);border-radius:8px;text-align:center;">';
      html += '<div style="font-size:11px;color:var(--text3);">Volume traite</div>';
      html += '<div style="font-size:22px;font-weight:800;color:#34d399;">' + fmt(data.total_volume_cents) + '</div>';
      html += '</div>';
      html += '<div style="padding:14px;background:rgba(233,69,96,0.08);border-radius:8px;text-align:center;">';
      html += '<div style="font-size:11px;color:var(--text3);">Commissions Lokizio</div>';
      html += '<div style="font-size:22px;font-weight:800;color:#e94560;">' + fmt(data.total_commission_cents) + '</div>';
      html += '</div>';
      html += '</div>';

      // Connect accounts overview
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">';
      html += '<div style="padding:10px;background:var(--surface2);border-radius:8px;">';
      html += '<div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Prestataires inscrits</div>';
      html += '<div style="font-size:18px;font-weight:700;color:var(--text);">' + (data.connect_accounts_total || 0) + '</div>';
      html += '</div>';
      html += '<div style="padding:10px;background:var(--surface2);border-radius:8px;">';
      html += '<div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Comptes KYC actifs</div>';
      html += '<div style="font-size:18px;font-weight:700;color:#34d399;">' + (data.connect_accounts_active || 0) + '</div>';
      html += '</div>';
      html += '</div>';

      // Monthly breakdown
      if (data.by_month && data.by_month.length) {
        html += '<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px;">Par mois</div>';
        html += '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px;">';
        html += '<thead><tr style="background:var(--surface2);color:var(--text3);"><th style="text-align:left;padding:6px 8px;">Mois</th><th style="text-align:right;padding:6px 8px;">Tx</th><th style="text-align:right;padding:6px 8px;">Volume</th><th style="text-align:right;padding:6px 8px;">Commission</th></tr></thead><tbody>';
        data.by_month.forEach(m => {
          html += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:6px 8px;color:var(--text);">' + monthLabel(m.month) + '</td>';
          html += '<td style="text-align:right;padding:6px 8px;color:var(--text2);">' + m.count + '</td>';
          html += '<td style="text-align:right;padding:6px 8px;color:var(--text);">' + fmt(m.volume_cents) + '</td>';
          html += '<td style="text-align:right;padding:6px 8px;color:#e94560;font-weight:600;">' + fmt(m.commission_cents) + '</td></tr>';
        });
        html += '</tbody></table>';
      }

      // Top beneficiaries
      if (data.top_beneficiaries && data.top_beneficiaries.length) {
        html += '<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px;">Top 5 prestataires payes</div>';
        html += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
        html += '<thead><tr style="background:var(--surface2);color:var(--text3);"><th style="text-align:left;padding:6px 8px;">Compte Stripe</th><th style="text-align:right;padding:6px 8px;">Tx</th><th style="text-align:right;padding:6px 8px;">Volume</th><th style="text-align:right;padding:6px 8px;">Commission</th></tr></thead><tbody>';
        data.top_beneficiaries.forEach(b => {
          const shortAcct = (b.account_id || '').slice(0, 16) + '…';
          html += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:6px 8px;color:var(--text);font-family:monospace;font-size:10px;">' + shortAcct + '</td>';
          html += '<td style="text-align:right;padding:6px 8px;color:var(--text2);">' + b.count + '</td>';
          html += '<td style="text-align:right;padding:6px 8px;color:var(--text);">' + fmt(b.volume_cents) + '</td>';
          html += '<td style="text-align:right;padding:6px 8px;color:#e94560;font-weight:600;">' + fmt(b.commission_cents) + '</td></tr>';
        });
        html += '</tbody></table>';
      }

      html += '<div style="font-size:10px;color:var(--text3);text-align:center;margin-top:14px;">Periode : ' + (new Date(data.from)).toLocaleDateString('fr-FR') + ' → ' + (new Date(data.to)).toLocaleDateString('fr-FR') + '</div>';
      html += '</div>';
      showMsg(html, true);
    } catch (e) {
      console.error('stripe-admin-stats:', e);
      showToast('Erreur stats: ' + (e.message || e));
    }
  }

  window.showStripeAdminDashboard = showStripeAdminDashboard;
})();
