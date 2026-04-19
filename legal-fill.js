// Fetches app_settings from Supabase and replaces [À COMPLÉTER] placeholders on legal pages.
// Uses the public anon key + RLS (SELECT open to all).

(async function () {
  const SUPABASE_URL = 'https://mrvejwyvhuivmipfwlzz.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydmVqd3l2aHVpdm1pcGZ3bHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjU0NTksImV4cCI6MjA4OTg0MTQ1OX0.1pi-KN5N6sNG6hIu6N0wDsR_g_G1TTf-uPecmWQ2ovU';
  try {
    const resp = await fetch(SUPABASE_URL + '/rest/v1/app_settings?id=eq.1&select=*', {
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY },
    });
    if (!resp.ok) return;
    const rows = await resp.json();
    const s = rows && rows[0];
    if (!s) return;

    const tvaLabel = s.tva_number || 'Non applicable - TVA non applicable, art. 293 B du CGI';
    const map = {
      'Nom complet ou raison sociale': s.company_name,
      'statut juridique': s.legal_status,
      'RCS/SIRET': s.siret,
      'adresse': s.address,
      'adresse complète': s.address,
      'email': s.contact_email,
      'email, ex. rgpd@lokizio.com': s.contact_email,
      'email RGPD': s.contact_email,
      'Nom / Raison sociale': s.company_name,
      'Nom complet / raison sociale': s.company_name,
      'nom': s.director_name,
      'SIRET': s.siret,
      'Non applicable - TVA non applicable, art. 293 B du CGI': tvaLabel,
      'désignation d\'un médiateur agréé, ex. CNPM Médiation Consommation': s.mediator,
      'ex. 9 €': s.price_pro ? s.price_pro + ' €' : '',
      'ex. 19 €': s.price_business ? s.price_business + ' €' : '',
    };

    // Walk through the document and replace bracketed placeholders like "[À COMPLÉTER — xxx]"
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) if (node.nodeValue && node.nodeValue.includes('[À COMPLÉTER')) nodes.push(node);
    nodes.forEach(n => {
      n.nodeValue = n.nodeValue.replace(/\[À COMPLÉTER\s*(?:—|-)\s*([^\]]+)\]/g, (full, hint) => {
        const h = hint.trim();
        // Find best match
        for (const [k, v] of Object.entries(map)) {
          if (v && (h.includes(k) || k.includes(h))) return v;
        }
        // If no match, keep placeholder
        return full;
      });
    });
  } catch (e) { /* silent - placeholders stay visible */ }
})();
