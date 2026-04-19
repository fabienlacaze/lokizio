// Global search module
// Depends on: sb, API, showMsg, closeMsg, showInvoiceDetail
// Exposes: showGlobalSearch, globalSearchChip, runGlobalSearch

async function showGlobalSearch() {
  let h = '<div style="font-size:15px;font-weight:700;margin-bottom:10px;">&#128269; Recherche globale</div>';
  h += '<input type="text" id="globalSearchInput" placeholder="Nom, numero, propriete, client..." oninput="runGlobalSearch(this.value)" style="width:100%;padding:10px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:10px;" autofocus>';
  const chips = [
    { label: '📄 Toutes les factures', q: 'factures' },
    { label: '🏠 Tous les biens', q: 'biens' },
    { label: '👥 Tous les membres', q: 'membres' },
    { label: '🧹 Toutes les prestations', q: 'prestations' },
  ];
  h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">';
  chips.forEach(c => {
    h += '<button onclick="globalSearchChip(\'' + c.q + '\')" style="padding:5px 10px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:14px;font-size:11px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'var(--surface)\'" onmouseout="this.style.background=\'var(--surface2)\'">' + c.label + '</button>';
  });
  h += '</div>';
  h += '<div id="globalSearchResults" style="max-height:400px;overflow-y:auto;"><div style="color:var(--text3);font-size:12px;text-align:center;padding:20px;">Tapez au moins 2 caracteres ou utilisez un raccourci ci-dessus</div></div>';
  showMsg(h);
  setTimeout(() => { const inp = document.getElementById('globalSearchInput'); if (inp) inp.focus(); }, 100);
}

function globalSearchChip(q) {
  const inp = document.getElementById('globalSearchInput');
  if (inp) { inp.value = q; runGlobalSearch(q); }
}

async function runGlobalSearch(q) {
  const out = document.getElementById('globalSearchResults');
  if (!out) return;
  q = (q || '').trim();
  if (q.length < 2) { out.innerHTML = '<div style="color:var(--text3);font-size:12px;text-align:center;padding:20px;">Tapez au moins 2 caracteres</div>'; return; }
  out.innerHTML = '<div style="color:var(--text3);font-size:12px;text-align:center;padding:12px;">Recherche...</div>';
  const org = API.getOrg();
  const orgId = org?.id;
  const like = '%' + q + '%';
  const lcq = q.toLowerCase();
  const queries = [];
  const kwInvoices = ['facture','factures','invoice','invoices','facturation'].some(k => lcq.includes(k));
  const kwProperties = ['bien','biens','propriete','proprietes','property','properties','maison','appartement'].some(k => lcq.includes(k));
  const kwMembers = ['membre','membres','equipe','team','prestataire','prestataires','proprietaire'].some(k => lcq.includes(k));
  const kwServices = ['prestation','prestations','menage','service','services'].some(k => lcq.includes(k));

  if (kwInvoices) queries.push(sb.from('invoices').select('id, invoice_number, client_name, total_ttc, type, status').order('created_at', { ascending: false }).limit(20));
  else queries.push(sb.from('invoices').select('id, invoice_number, client_name, total_ttc, type, status').or('invoice_number.ilike.' + like + ',client_name.ilike.' + like).limit(10));

  const propQ = (filter) => {
    let q2 = sb.from('properties').select('id, name, owner_name, address');
    if (orgId) q2 = q2.eq('org_id', orgId);
    return filter ? filter(q2) : q2;
  };
  if (kwProperties) queries.push(propQ(q2 => q2.limit(20)));
  else queries.push(propQ(q2 => q2.or('name.ilike.' + like + ',owner_name.ilike.' + like + ',address.ilike.' + like).limit(10)));

  if (orgId) {
    if (kwMembers) queries.push(sb.from('members').select('id, display_name, invited_email, role').eq('org_id', orgId).limit(20));
    else queries.push(sb.from('members').select('id, display_name, invited_email, role').eq('org_id', orgId).or('display_name.ilike.' + like + ',invited_email.ilike.' + like).limit(10));
  }

  const srQ = (filter) => {
    let q2 = sb.from('service_requests').select('id, service_type, status, requested_date, property_id');
    if (orgId) q2 = q2.eq('org_id', orgId);
    return filter ? filter(q2) : q2;
  };
  if (kwServices) queries.push(srQ(q2 => q2.order('requested_date', { ascending: false }).limit(20)));
  else queries.push(srQ(q2 => q2.ilike('service_type', like).limit(10)));

  const settled = await Promise.allSettled(queries);
  const invRes = settled[0];
  const propRes = settled[1];
  const memRes = orgId ? settled[2] : null;
  const srRes = orgId ? settled[3] : settled[2];
  let h = '';
  function section(title, items, renderItem) {
    if (!items || !items.length) return;
    h += '<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin:10px 0 4px;">' + title + ' (' + items.length + ')</div>';
    items.forEach(it => { h += renderItem(it); });
  }
  section('Factures', invRes?.value?.data, inv => {
    return '<div onclick="closeMsg();setTimeout(()=>showInvoiceDetail(\'' + inv.id + '\'),150)" style="background:var(--surface2);border-radius:8px;padding:8px 10px;font-size:12px;margin-bottom:4px;cursor:pointer;" onmouseover="this.style.background=\'var(--surface)\'" onmouseout="this.style.background=\'var(--surface2)\'"><strong>' + (inv.invoice_number || '—') + '</strong> · ' + (inv.client_name || '') + ' · ' + (inv.total_ttc || 0) + '€ <span style="color:var(--text3);font-size:10px;">(' + inv.status + ')</span></div>';
  });
  section('Proprietes', propRes?.value?.data, p => {
    return '<div style="background:var(--surface2);border-radius:8px;padding:8px 10px;font-size:12px;margin-bottom:4px;">&#127968; <strong>' + (p.name || '—') + '</strong>' + (p.owner_name ? ' · ' + p.owner_name : '') + (p.address ? '<div style="color:var(--text3);font-size:10px;">' + p.address + '</div>' : '') + '</div>';
  });
  section('Membres', memRes?.value?.data, m => {
    return '<div style="background:var(--surface2);border-radius:8px;padding:8px 10px;font-size:12px;margin-bottom:4px;">&#128100; <strong>' + (m.display_name || m.invited_email || '—') + '</strong> <span style="color:var(--text3);font-size:10px;">(' + m.role + ')</span></div>';
  });
  section('Prestations', srRes?.value?.data, r => {
    return '<div style="background:var(--surface2);border-radius:8px;padding:8px 10px;font-size:12px;margin-bottom:4px;">&#129529; <strong>' + (r.service_type || '—') + '</strong> · ' + (r.requested_date || '') + ' <span style="color:var(--text3);font-size:10px;">(' + r.status + ')</span></div>';
  });
  if (!h) {
    h = '<div style="color:var(--text3);font-size:12px;text-align:center;padding:20px;">Aucun resultat pour "' + q + '"';
    if (!orgId) h += '<div style="font-size:10px;margin-top:6px;opacity:0.7;">Vous n\'appartenez pas a une organisation - seules vos donnees personnelles sont accessibles.</div>';
    h += '</div>';
  }
  out.innerHTML = h;
}

window.showGlobalSearch = showGlobalSearch;
window.globalSearchChip = globalSearchChip;
window.runGlobalSearch = runGlobalSearch;
