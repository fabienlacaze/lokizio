#!/usr/bin/env node
// Add aria-label to inputs that lack label and aria-label.

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'index.html';
let html = readFileSync(FILE, 'utf8');
let changes = 0;

const labelFors = new Set([...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map(m => m[1]));

const ID_LABELS = {
  authRgpdAccept: 'Accepter les CGU',
  annCityFilter: 'Filtrer par ville',
  invoiceSearch: 'Rechercher une facture',
  fullChatInput: 'Nouveau message',
  mkCityFilter: 'Filtrer par ville',
  themeToggleAccount: 'Basculer le theme',
  profileName: 'Nom complet',
  profilePhone: 'Telephone',
  profileAddress: 'Adresse',
  profileNotifEmail: 'Notifications email',
  profileNotifPush: 'Notifications push',
  billingCompany: 'Raison sociale',
  billingSiret: 'Numero SIRET',
  billingVat: 'Taux TVA',
  billingAddress: 'Adresse de facturation',
  mkVisibleToggle: 'Profil visible annuaire',
  mkName: 'Nom commercial',
  mkCity: 'Ville',
  mkPhone: 'Telephone',
  mkExperienceYears: 'Annees experience',
  inviteEmail: 'Email invite',
  inviteTenantStart: 'Date debut reservation',
  inviteTenantEnd: 'Date fin reservation',
  inviteTenantAccess: 'Instructions acces logement',
  wizPropName: 'Nom du bien',
  wizPropRooms: 'Nombre de pieces',
  wizPropSurface: 'Surface m2',
  wizPropTarif: 'Tarif a la nuit',
  wizPropCheckin: 'Heure check-in',
  wizPropCheckout: 'Heure check-out',
  wizPropCode: 'Code acces',
  wizProvName: 'Nom prestataire',
  wizProvPhone: 'Telephone prestataire',
  wizProvEmail: 'Email prestataire',
  wizProvAddress: 'Adresse prestataire',
  wizProvPct: 'Pourcentage de repartition',
  wizProvPrice: 'Prix unitaire',
  wizProvMax: 'Capacite max',
  wizProvSelfName: 'Votre nom',
  wizProvSelfPhone: 'Votre telephone',
  wizRadius: 'Rayon en km',
  vacFrom: 'Date debut vacances',
  vacTo: 'Date fin vacances',
  addPropName: 'Nom du nouveau bien',
  mrCheckin: 'Date check-in manuel',
  mrCheckout: 'Date check-out manuel',
  mrGuest: 'Nom voyageur',
  svcReqDate: 'Date demande service',
  svcReqPrice: 'Prix service',
  billingPeriod: 'Periode facturation',
  billingDay: 'Jour du mois',
  billingDueDays: 'Delai paiement en jours',
  promptInput: 'Reponse',
  propPhotoInput: 'Photo du bien',
  propDetailName: 'Nom du bien',
  propDetailRooms: 'Nombre de pieces',
  propDetailSurface: 'Surface en m2',
  propDetailCheckin: 'Heure check-in',
  propDetailCheckout: 'Heure check-out',
  mapRadius: 'Rayon de recherche',
  disputePhotos: 'Photos preuve litige',
};

// inputs + selects + textareas
function fixTag(tagName) {
  const re = new RegExp(`<${tagName}\\b([^>]*)>`, 'g');
  html = html.replace(re, (full, attrs) => {
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    if (!idMatch) return full;
    const id = idMatch[1];
    if (labelFors.has(id)) return full;
    if (/\baria-label\b/.test(attrs)) return full;
    if (/\btype="hidden"/.test(attrs)) return full;

    let label = null;
    const phMatch = attrs.match(/\bplaceholder="([^"]+)"/);
    if (phMatch) label = phMatch[1];
    else if (ID_LABELS[id]) label = ID_LABELS[id];
    else return full;

    changes++;
    return `<${tagName} aria-label="${label.replace(/"/g, '')}"${attrs}>`;
  });
}

fixTag('input');
fixTag('select');
fixTag('textarea');

writeFileSync(FILE, html);
console.log(`a11y input/select/textarea fixes: ${changes}`);
