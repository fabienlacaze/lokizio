// Quotes (devis) module
// Depends on globals: sb, API, customConfirm, showToast, sendPushToUser,
//   loadInvoices, _renderInvoiceCard
// Exposes: acceptQuote, refuseQuote, convertQuoteToInvoice, loadQuotes, switchFinQuoteTab

async function acceptQuote(id) {
  const ok = await customConfirm('Marquer ce devis comme accepte par le client ?', 'Accepter');
  if (!ok) return;
  const { data: q } = await sb.from('invoices').select('*').eq('id', id).single();
  const { error } = await sb.from('invoices').update({ status: 'accepted', quote_accepted_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  showToast('Devis marque accepte');
  try { await notifyQuoteDecision(q, 'accepted'); } catch {}
  loadInvoices();
}

async function refuseQuote(id) {
  const ok = await customConfirm('Marquer ce devis comme refuse par le client ?', 'Refuser');
  if (!ok) return;
  const { data: q } = await sb.from('invoices').select('*').eq('id', id).single();
  const { error } = await sb.from('invoices').update({ status: 'refused', quote_refused_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  showToast('Devis marque refuse');
  try { await notifyQuoteDecision(q, 'refused'); } catch {}
  loadInvoices();
}

async function notifyQuoteDecision(q, decision) {
  if (!q) return;
  const org = API.getOrg();
  if (!org) return;
  const { data: members } = await sb.from('members').select('user_id,display_name,invited_email,company_name').eq('org_id', org.id);
  const issuerUser = (members || []).find(m => q.issuer_name && (m.display_name === q.issuer_name || m.company_name === q.issuer_name));
  if (!issuerUser?.user_id) return;
  const num = q.invoice_number || '';
  const client = q.client_name || '';
  if (decision === 'accepted') {
    await sendPushToUser(issuerUser.user_id, 'Devis accepte', client + ' a accepte le devis ' + num, { tag: 'quote-' + q.id });
  } else {
    await sendPushToUser(issuerUser.user_id, 'Devis refuse', client + ' a refuse le devis ' + num, { tag: 'quote-' + q.id });
  }
}

async function convertQuoteToInvoice(quoteId) {
  const ok = await customConfirm('Convertir ce devis en facture ? Le devis sera marque comme accepte.', 'Convertir');
  if (!ok) return;
  try {
    const { data: q } = await sb.from('invoices').select('*').eq('id', quoteId).single();
    if (!q || !q.is_quote) { showToast('Devis introuvable'); return; }
    const year = new Date().getFullYear();
    const { count } = await sb.from('invoices').select('*', { count: 'exact', head: true }).eq('org_id', q.org_id).eq('is_quote', false);
    const num = String((count || 0) + 1).padStart(4, '0');
    const invoiceNumber = 'FAC-' + year + '-' + num;
    const copy = { ...q };
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;
    delete copy.quote_valid_until;
    delete copy.quote_accepted_at;
    delete copy.quote_refused_at;
    copy.is_quote = false;
    copy.status = 'draft';
    copy.invoice_number = invoiceNumber;
    copy.converted_from_quote_id = quoteId;
    const { error: insErr } = await sb.from('invoices').insert(copy);
    if (insErr) { showToast('Erreur: ' + insErr.message); return; }
    await sb.from('invoices').update({ status: 'accepted', quote_accepted_at: new Date().toISOString() }).eq('id', quoteId);
    showToast('Devis converti en facture ' + invoiceNumber);
    loadInvoices();
  } catch(e) { console.error('convertQuoteToInvoice:', e); showToast('Erreur: ' + e.message); }
}

function switchFinQuoteTab(tab) {
  const btns = { create: document.getElementById('finQuoteTab_create'), list: document.getElementById('finQuoteTab_list') };
  const panels = { create: document.getElementById('finQuotePanel_create'), list: document.getElementById('finQuotePanel_list') };
  Object.values(btns).forEach(b => b && b.classList.remove('annSubTabActive'));
  Object.values(panels).forEach(p => p && (p.style.display = 'none'));
  if (btns[tab]) btns[tab].classList.add('annSubTabActive');
  if (panels[tab]) panels[tab].style.display = '';
  if (tab === 'list') loadQuotes();
}

async function loadQuotes() {
  const container = document.getElementById('quotesList');
  const summary = document.getElementById('quotesSummary');
  if (!container) return;
  const org = API.getOrg();
  if (!org) { container.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px;">Organisation introuvable.</div>'; return; }
  container.innerHTML = '<div style="text-align:center;color:var(--text3);padding:20px;">Chargement...</div>';
  const { data: quotes, error } = await sb.from('invoices').select('*').eq('org_id', org.id).eq('is_quote', true).order('created_at', { ascending: false });
  if (error) { container.innerHTML = '<div style="color:var(--error);padding:20px;">Erreur: ' + error.message + '</div>'; return; }
  if (!quotes || !quotes.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:13px;padding:30px 20px;"><div style="font-size:32px;opacity:0.4;margin-bottom:8px;">&#128203;</div>Aucun devis encore. Cliquez sur Creer pour en emettre un.</div>';
    if (summary) summary.innerHTML = '';
    return;
  }
  const sent = quotes.filter(q => q.status === 'sent').length;
  const accepted = quotes.filter(q => q.status === 'accepted').length;
  const totalAcc = quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + (q.total_ttc || 0), 0);
  if (summary) {
    summary.innerHTML = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">' +
      '<div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--text);">' + quotes.length + '</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Total</div></div>' +
      '<div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#6c63ff;">' + sent + '</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;">En attente</div></div>' +
      '<div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:18px;font-weight:800;color:#34d399;">' + accepted + '</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Acceptes</div></div>' +
      '<div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:16px;font-weight:800;color:#34d399;">' + totalAcc.toFixed(0) + '€</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;">CA potentiel</div></div>' +
      '</div>';
  }
  const today = new Date().toISOString().split('T')[0];
  container.innerHTML = quotes.map(q => _renderInvoiceCard(q, today)).join('');
}

// Export to window
window.acceptQuote = acceptQuote;
window.refuseQuote = refuseQuote;
window.notifyQuoteDecision = notifyQuoteDecision;
window.convertQuoteToInvoice = convertQuoteToInvoice;
window.switchFinQuoteTab = switchFinQuoteTab;
window.loadQuotes = loadQuotes;
