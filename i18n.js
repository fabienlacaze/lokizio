/**
 * i18n.js - Internationalization system for Menage Manager
 * Supports French (fr) and English (en) with flag toggle.
 */
const I18N = {
  fr: {
    // Auth
    'auth.title': 'Menage Manager',
    'auth.subtitle': 'Gestion des menages locatifs',
    'auth.tab.login': 'Se connecter',
    'auth.tab.register': 'Creer un compte',
    'auth.email': 'Email',
    'auth.password': 'Mot de passe',
    'auth.password.placeholder': '6 caracteres minimum',
    'auth.confirm': 'Confirmer le mot de passe',
    'auth.confirm.placeholder': 'Retapez le mot de passe',
    'auth.login.btn': 'Se connecter',
    'auth.register.btn': 'Creer mon compte',
    'auth.register.loading': 'Creation en cours...',
    'auth.fill.all': 'Remplissez tous les champs',
    'auth.pass.min': 'Le mot de passe doit faire au moins 6 caracteres',
    'auth.pass.mismatch': 'Les mots de passe ne correspondent pas',
    'auth.email.taken': 'Cet email est deja utilise',
    'auth.login.invalid': 'Email ou mot de passe incorrect',
    'auth.register.success': 'Compte cree !',
    'auth.register.check_email': 'Un email de confirmation a ete envoye a <b>{email}</b>.<br>Cliquez sur le lien dans l\'email puis revenez vous connecter.',
    'auth.register.connecting': 'Compte cree ! Connexion...',
    'auth.logout.confirm': 'Se deconnecter ?',

    // Header
    'header.subtitle': 'Gestion des menages',
    'header.share': 'Partager en lecture seule',
    'header.changelog': 'Historique modifications',
    'header.theme': 'Theme clair/sombre',
    'header.help': 'Aide',
    'header.logout': 'Deconnexion',

    // Install banner
    'install.title': 'Installer Menage Manager',
    'install.subtitle': 'Acces rapide depuis l\'ecran d\'accueil',
    'install.btn': 'Installer',

    // Config panel
    'config.title': 'Configuration',
    'config.ical': 'Calendriers iCal',
    'config.ical.airbnb': 'URL iCal Airbnb...',
    'config.ical.booking': 'URL iCal Booking...',
    'config.paste': 'Coller',
    'config.providers': 'Prestataires',
    'config.name': 'Nom',
    'config.phone': 'Telephone',
    'config.pct': '%',
    'config.price': 'Tarif',
    'config.add': '+ Ajouter',

    // Generate
    'generate.title': 'Generer',
    'generate.btn': 'GENERER LE PLANNING',
    'generate.save': 'Sauvegarder config',

    // Map
    'map.radius': 'Rayon :',
    'map.save': 'Enregistrer',
    'map.provider_zone': 'Zone de',
    'map.property_location': 'Position de',
    'map.saved': 'Position enregistree pour',
    'map.not_found': 'Adresse non trouvee',
    'map.search': 'Rechercher une adresse...',

    // Communication & Export
    'comm.title': 'Communication & Export',
    'comm.share': 'Partager (lecture seule)',
    'comm.export': 'Exporter',

    // Results panel
    'results.title': 'Resultats',
    'results.tab.list': 'Liste',
    'results.tab.calendar': 'Calendrier',
    'results.tab.stats': 'Stats',
    'results.tab.history': 'Historique',
    'results.tab.pressing': 'Pressing',
    'results.empty': 'Cliquez sur GENERER LE PLANNING pour afficher les menages',
    'results.csv': 'CSV',
    'results.pdf': 'PDF',
    'results.copy': 'Copier',
    'results.whatsapp': 'WhatsApp',
    'results.clear_history': 'Effacer l\'historique',

    // Stats
    'stats.empty': 'Generez un planning pour voir les statistiques.',

    // Modals
    'modal.ok': 'OK',
    'modal.close': 'Fermer',
    'modal.vacations': 'Vacances prestataire',

    // Help
    'help.title': 'Aide',
    'help.config.title': '1. Configuration',
    'help.config.text': 'Collez les URLs iCal depuis Airbnb et Booking. Ajoutez vos prestataires avec leur pourcentage (total = 100%).',
    'help.planning.title': '2. Planning',
    'help.planning.text': 'Cliquez GENERER pour telecharger les calendriers et attribuer les menages automatiquement.',
    'help.results.title': '3. Resultats',
    'help.results.text': 'Changez les prestataires, filtrez, cochez "Transmis" pour les dates envoyees.',
    'help.features': 'Fonctionnalites',
    'help.feature.persist': 'modifications sauvegardees automatiquement.',
    'help.feature.whatsapp': 'envoyez le planning a chaque prestataire.',
    'help.feature.calendar': 'vue mensuelle avec menages et reservations.',
    'help.feature.stats': 'graphiques de repartition par prestataire.',
    'help.feature.history': 'les menages passes sont archives.',
    'help.feature.notif': 'alertes 2 jours avant arrivee/depart.',
    'help.feature.link': 'partagez un lien read-only.',

    // Bottom nav
    'nav.config': 'Config',
    'nav.generate': 'Generer',
    'nav.results': 'Planning',
    'nav.stats': 'Stats',
    'nav.more': 'Plus',

    // Properties
    'property.label': 'Propriete :',
    'property.add': '+ Ajouter',
    'property.name_prompt': 'Nom de la propriete :',
    'property.remove_confirm': 'Supprimer',

    // Premium
    'premium.title': 'Passez a Premium',
    'premium.subtitle': 'Prestataires illimites, pas de publicite',
    'premium.btn': 'Voir les offres',
    'premium.modal.title': 'Choisissez votre plan',
    'premium.plan.free': 'Gratuit',
    'premium.plan.current': 'Plan actuel',
    'premium.free.property': '1 propriete',
    'premium.free.providers': '2 prestataires max',
    'premium.free.ical': 'Calendrier iCal',
    'premium.free.ads': 'Publicites',
    'premium.feat.properties': 'Proprietes illimitees',
    'premium.feat.providers': 'Prestataires illimites',
    'premium.feat.noads': 'Aucune publicite',
    'premium.feat.priority': 'Support prioritaire',
    'premium.feat.export': 'Export PDF avance',
    'premium.btn.upgrade': 'Passer a Premium',
    'premium.cancel': 'Annulable a tout moment. Paiement securise par Stripe.',
    'premium.stripe.pending': 'Le paiement sera bientot disponible. Contactez-nous pour un acces anticipe !',
    'ad.label': 'Publicite',
    'ad.remove': 'Supprimer les pubs',

    // Status
    'status.ready': 'Pret',
    'status.restored': 'Planning restaure',
  },

  en: {
    // Auth
    'auth.title': 'Menage Manager',
    'auth.subtitle': 'Rental cleaning management',
    'auth.tab.login': 'Sign in',
    'auth.tab.register': 'Create account',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.password.placeholder': '6 characters minimum',
    'auth.confirm': 'Confirm password',
    'auth.confirm.placeholder': 'Retype password',
    'auth.login.btn': 'Sign in',
    'auth.register.btn': 'Create my account',
    'auth.register.loading': 'Creating account...',
    'auth.fill.all': 'Please fill all fields',
    'auth.pass.min': 'Password must be at least 6 characters',
    'auth.pass.mismatch': 'Passwords do not match',
    'auth.email.taken': 'This email is already in use',
    'auth.login.invalid': 'Invalid email or password',
    'auth.register.success': 'Account created!',
    'auth.register.check_email': 'A confirmation email has been sent to <b>{email}</b>.<br>Click the link in the email then come back to sign in.',
    'auth.register.connecting': 'Account created! Signing in...',
    'auth.logout.confirm': 'Sign out?',

    // Header
    'header.subtitle': 'Cleaning management',
    'header.share': 'Share read-only link',
    'header.changelog': 'Change log',
    'header.theme': 'Light/dark theme',
    'header.help': 'Help',
    'header.logout': 'Sign out',

    // Install banner
    'install.title': 'Install Menage Manager',
    'install.subtitle': 'Quick access from home screen',
    'install.btn': 'Install',

    // Config panel
    'config.title': 'Configuration',
    'config.ical': 'iCal Calendars',
    'config.ical.airbnb': 'Airbnb iCal URL...',
    'config.ical.booking': 'Booking iCal URL...',
    'config.paste': 'Paste',
    'config.providers': 'Providers',
    'config.name': 'Name',
    'config.phone': 'Phone',
    'config.pct': '%',
    'config.price': 'Rate',
    'config.add': '+ Add',

    // Generate
    'generate.title': 'Generate',
    'generate.btn': 'GENERATE PLANNING',
    'generate.save': 'Save config',

    // Results panel
    // Communication & Export
    'comm.title': 'Communication & Export',
    'comm.share': 'Share (read-only)',
    'comm.export': 'Export',

    'results.title': 'Results',
    'results.tab.list': 'List',
    'results.tab.calendar': 'Calendar',
    'results.tab.stats': 'Stats',
    'results.tab.history': 'History',
    'results.tab.pressing': 'Laundry',
    'results.empty': 'Click GENERATE PLANNING to display cleanings',
    'results.csv': 'CSV',
    'results.pdf': 'PDF',
    'results.copy': 'Copy',
    'results.whatsapp': 'WhatsApp',
    'results.clear_history': 'Clear history',

    // Stats
    'stats.empty': 'Generate a planning to see statistics.',

    // Modals
    'modal.ok': 'OK',
    'modal.close': 'Close',
    'modal.vacations': 'Provider vacations',

    // Help
    'help.title': 'Help',
    'help.config.title': '1. Configuration',
    'help.config.text': 'Paste iCal URLs from Airbnb and Booking. Add your providers with their percentage (total = 100%).',
    'help.planning.title': '2. Planning',
    'help.planning.text': 'Click GENERATE to download calendars and automatically assign cleanings.',
    'help.results.title': '3. Results',
    'help.results.text': 'Change providers, filter, check "Transmitted" for sent dates.',
    'help.features': 'Features',
    'help.feature.persist': 'changes saved automatically.',
    'help.feature.whatsapp': 'send the planning to each provider.',
    'help.feature.calendar': 'monthly view with cleanings and bookings.',
    'help.feature.stats': 'distribution charts per provider.',
    'help.feature.history': 'past cleanings are archived.',
    'help.feature.notif': 'alerts 2 days before check-in/out.',
    'help.feature.link': 'share a read-only link.',

    // Map
    'map.radius': 'Radius:',
    'map.save': 'Save',
    'map.provider_zone': 'Zone of',
    'map.property_location': 'Location of',
    'map.saved': 'Location saved for',
    'map.not_found': 'Address not found',
    'map.search': 'Search an address...',

    // Status
    // Premium
    // Bottom nav
    'nav.config': 'Config',
    'nav.generate': 'Generate',
    'nav.results': 'Planning',
    'nav.stats': 'Stats',
    'nav.more': 'More',

    // Properties
    'property.label': 'Property:',
    'property.add': '+ Add',
    'property.name_prompt': 'Property name:',
    'property.remove_confirm': 'Delete',

    'premium.title': 'Upgrade to Premium',
    'premium.subtitle': 'Unlimited providers, no ads',
    'premium.btn': 'See plans',
    'premium.modal.title': 'Choose your plan',
    'premium.plan.free': 'Free',
    'premium.plan.current': 'Current plan',
    'premium.free.property': '1 property',
    'premium.free.providers': '2 providers max',
    'premium.free.ical': 'iCal calendar',
    'premium.free.ads': 'Advertisements',
    'premium.feat.properties': 'Unlimited properties',
    'premium.feat.providers': 'Unlimited providers',
    'premium.feat.noads': 'No ads',
    'premium.feat.priority': 'Priority support',
    'premium.feat.export': 'Advanced PDF export',
    'premium.btn.upgrade': 'Upgrade to Premium',
    'premium.cancel': 'Cancel anytime. Secure payment by Stripe.',
    'premium.stripe.pending': 'Payment coming soon. Contact us for early access!',
    'ad.label': 'Advertisement',
    'ad.remove': 'Remove ads',

    'status.ready': 'Ready',
    'status.restored': 'Planning restored',
  }
};

let currentLang = localStorage.getItem('mm_lang') || 'fr';

function t(key, params) {
  let str = (I18N[currentLang] && I18N[currentLang][key]) || (I18N.fr[key]) || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, v);
    }
  }
  return str;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('mm_lang', lang);
  document.documentElement.setAttribute('lang', lang);
  // Update all elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    if (attr === 'placeholder') {
      el.placeholder = t(key);
    } else if (attr === 'title') {
      el.title = t(key);
    } else {
      el.innerHTML = t(key);
    }
  });
  // Update flag buttons
  document.querySelectorAll('.lang-flag').forEach(el => {
    el.style.opacity = el.getAttribute('data-lang') === lang ? '1' : '0.4';
  });
  // Update auth tab text
  if (typeof switchAuthTab === 'function' && typeof authMode !== 'undefined') {
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    if (tabLogin) tabLogin.textContent = t('auth.tab.login');
    if (tabRegister) tabRegister.textContent = t('auth.tab.register');
    const submitBtn = document.getElementById('authSubmitBtn');
    if (submitBtn) submitBtn.textContent = authMode === 'login' ? t('auth.login.btn') : t('auth.register.btn');
  }
}
