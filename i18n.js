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

    // Sections
    'section.property': 'Propriete',
    'section.team': 'Equipe menage',
    'section.history': 'Historique & Pressing',

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
    'provider.add.title': 'Ajouter un prestataire',

    // Table headers
    'table.source': 'Source',
    'table.checkin': 'Arrivee',
    'table.checkout': 'Depart',
    'table.interval': 'Intervalle',
    'table.cleaning': 'Menage le',
    'table.provider': 'Prestataire',

    // Generate
    'generate.title': 'Generer',
    'generate.btn': 'GENERER LE PLANNING',
    'generate.save': 'Sauvegarder config',

    // Map
    'map.radius': 'Rayon :',
    // Property detail modal
    'prop.detail.title': 'Details de la propriete',
    'prop.detail.name': 'Nom',
    'prop.detail.address': 'Adresse',
    'prop.detail.type': 'Type',
    'prop.detail.rooms': 'Pieces',
    'prop.detail.price': 'Tarif menage (€)',
    'prop.detail.duration': 'Duree estimee',
    'prop.detail.checklist': 'Instructions de menage',
    'prop.detail.notes': 'Notes',
    'prop.detail.save': 'Enregistrer',
    'prop.detail.saved': 'Propriete enregistree',

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

    // Validation
    'validation.name.required': 'Veuillez saisir un nom.',
    'config.ical.required': 'Saisissez au moins une URL iCal.',
    'config.provider.required': 'Ajoutez au moins un prestataire.',
    'config.percentages.invalid': 'Le total des pourcentages doit etre 100%',
    'config.saved': 'Configuration sauvegardee',

    // Generate
    'generate.loading': 'Generation en cours...',
    'generate.success': 'Planning genere avec succes',
    'generate.refresh': 'Rafraichir',
    'generate.remaining': 'reste {n} generation(s) gratuite(s)',

    // Export
    'export.empty': 'Aucun planning a exporter.',
    'export.filter.empty': 'Aucun menage avec ce filtre.',
    'export.csv.success': 'CSV exporte : {n} menage(s)',
    'export.pdf.success': 'PDF exporte : {n} menage(s)',
    'export.pdf.title': 'Planning Menages',
    'export.pdf.generated': 'Genere le',
    'export.text.copied': 'Planning copie',

    // WhatsApp
    'whatsapp.empty': 'Aucun menage pour',
    'whatsapp.opened': 'Copie + WhatsApp ouvert pour',
    'whatsapp.copied': 'Planning copie dans le presse-papier !',
    'whatsapp.empty.all': 'Aucun planning a envoyer.',
    'whatsapp.no.providers': 'Aucun prestataire avec des menages.',
    'whatsapp.title': 'Envoyer par WhatsApp',
    'whatsapp.select': 'Cliquez sur un prestataire :',

    // Share
    'share.save.first': 'Sauvegardez la configuration d\'abord.',
    'share.link.copied': 'Lien lecture seule copie !',

    // Provider
    'provider.added': 'ajoute',
    'provider.delete.confirm': 'Supprimer le prestataire',
    'provider.link.copied': 'Lien prestataire copie !',
    'provider.zone.define': 'Definir la zone',

    // Vacation
    'vacation.none': 'Aucune',
    'vacation.title': 'Vacances de',
    'vacation.empty': 'Aucune periode de vacances.',
    'vacation.dates.required': 'Selectionnez les deux dates.',
    'vacation.dates.invalid': 'La date de debut doit etre avant la fin.',

    // Linen
    'linen.name.required': 'Saisissez un nom pour le jeu de linge.',
    'linen.duplicate': 'Ce jeu existe deja.',
    'linen.empty': 'Aucun jeu de linge. Ajoutez-en un ci-dessus.',
    'linen.status.available': 'Disponible',
    'linen.status.used': 'Utilise',
    'linen.status.pressing': 'Au pressing',
    'linen.action.mark.used': 'Marquer utilise',
    'linen.action.send.pressing': 'Envoyer au pressing',
    'linen.action.return': 'Retour du pressing',
    'linen.last.used': 'Dernier usage :',
    'linen.never.used': 'Jamais utilise',
    'linen.history.recent': 'Historique recent',

    // iCal
    'ical.empty': 'Aucun calendrier configure',
    'ical.all.added': 'Toutes les plateformes sont deja ajoutees',
    'ical.choose.platform': 'Choisir une plateforme :',
    'ical.add.title': 'Ajouter un calendrier',
    'ical.add.button': '+ Ajouter un calendrier',
    'ical.delete.confirm': 'Supprimer le calendrier',

    // Property
    'property.click.configure': 'Cliquez ✏️ pour configurer la propriete',
    'property.type.apartment': 'Appartement',
    'property.type.house': 'Maison',
    'property.type.studio': 'Studio',
    'property.type.villa': 'Villa',
    'property.type.chalet': 'Chalet',
    'property.type.other': 'Autre',
    'property.image.toolarge': 'Image trop grande (max 500 Ko)',
    'property.checklist.empty': 'Aucune instruction',
    'property.name.placeholder': 'Nom du logement',
    'property.instruction.placeholder': 'Nouvelle instruction...',

    // Time
    'time.today': 'aujourd\'hui',
    'time.tomorrow': 'demain',
    'time.in2days': 'dans 2 jours',

    // Notifications
    'notification.unsupported': 'Notifications non supportees par ce navigateur.',
    'notification.blocked': 'Notifications bloquees. Autorisez-les dans les parametres.',
    'notification.denied': 'Permission de notification refusee.',
    'reminder.duplicate': 'Rappel deja programme pour',
    'reminder.scheduled': 'Rappel programme J-2 pour',

    // Premium limits
    'premium.limit.providers': 'Vous avez atteint la limite de {n} prestataires.',
    'premium.limit.properties': 'Vous avez atteint la limite de {n} propriete(s).',
    'premium.limit.icals': 'Vous avez atteint la limite de {n} calendriers.',
    'premium.limit.generations': 'Limite de {n} generations/jour atteinte.',
    'premium.stats.locked': 'Les graphiques et couts sont reserves aux utilisateurs Premium',
    'premium.comm.locked': 'WhatsApp, PDF et Partage sont reserves aux utilisateurs Premium',
    'premium.history.locked': 'L\'historique et le pressing sont reserves aux utilisateurs Premium',
    'premium.upgrade.text': 'Passez a Premium pour debloquer.',

    // Confirm
    'confirm.title': 'Confirmer',
    'confirm.cancel': 'Annuler',
    'confirm.delete': 'Supprimer',

    // Changelog
    'changelog.title': 'Historique des modifications',
    'changelog.empty': 'Aucune modification enregistree.',
    'changelog.cleared': 'Historique efface',

    // Calendar
    // Send modal
    'send.btn': 'Envoyer',
    'send.title': 'Envoyer le planning',
    'send.copy': 'Copier le texte',

    'calendar.legend.cleaning': 'Menage',
    'calendar.legend.reservation': 'Reservation',
    'calendar.today': 'Aujourd\'hui',

    // Help tooltips
    'help.property': 'Configurez votre logement : nom, adresse, calendriers iCal. Cliquez ✏️ pour les details et 📍 pour la position.',
    'help.providers': 'Ajoutez vos prestataires avec leur % de repartition (total = 100%). Cliquez 📍 pour definir leur zone d\'action.',
    'help.planning': 'Le planning est genere automatiquement. Cliquez Rafraichir pour forcer la mise a jour. Filtrez par prestataire.',
    'help.communication': 'Exportez en CSV ou envoyez via WhatsApp. Partagez un lien lecture seule.',
    'help.history': 'Les menages passes sont archives automatiquement. Gerez vos jeux de linge dans Pressing.',

    // Table headers (provider list)
    'table.name': 'Nom',
    'table.phone': 'Tel',
    'table.pct': '%',
    'table.rate': 'Tarif',
    'table.vacations': 'Vacances',
    'table.link': 'Lien',

    // Results
    'results.empty.future': 'Aucun menage a venir.',
    'results.loading': 'Chargement en cours...',
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
    'provider.add.title': 'Add a provider',

    // Table headers
    'table.source': 'Source',
    'table.checkin': 'Check-in',
    'table.checkout': 'Check-out',
    'table.interval': 'Interval',
    'table.cleaning': 'Cleaning on',
    'table.provider': 'Provider',

    // Generate
    'generate.title': 'Generate',
    'generate.btn': 'GENERATE PLANNING',
    'generate.save': 'Save config',

    // Results panel
    // Sections
    'section.property': 'Property',
    'section.team': 'Cleaning team',
    'section.history': 'History & Linens',

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

    // Property detail modal
    'prop.detail.title': 'Property details',
    'prop.detail.name': 'Name',
    'prop.detail.address': 'Address',
    'prop.detail.type': 'Type',
    'prop.detail.rooms': 'Rooms',
    'prop.detail.price': 'Cleaning price (€)',
    'prop.detail.duration': 'Estimated duration',
    'prop.detail.checklist': 'Cleaning instructions',
    'prop.detail.notes': 'Notes',
    'prop.detail.save': 'Save',
    'prop.detail.saved': 'Property saved',

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

    // Validation
    'validation.name.required': 'Please enter a name.',
    'config.ical.required': 'Enter at least one iCal URL.',
    'config.provider.required': 'Add at least one provider.',
    'config.percentages.invalid': 'Total percentages must be 100%',
    'config.saved': 'Configuration saved',

    // Generate
    'generate.loading': 'Generating planning...',
    'generate.success': 'Planning generated successfully',
    'generate.refresh': 'Refresh',
    'generate.remaining': '{n} free generation(s) remaining',

    // Export
    'export.empty': 'No planning to export.',
    'export.filter.empty': 'No cleaning with this filter.',
    'export.csv.success': 'CSV exported: {n} cleaning(s)',
    'export.pdf.success': 'PDF exported: {n} cleaning(s)',
    'export.pdf.title': 'Cleaning Planning',
    'export.pdf.generated': 'Generated on',
    'export.text.copied': 'Planning copied',

    // WhatsApp
    'whatsapp.empty': 'No cleaning for',
    'whatsapp.opened': 'Copied + WhatsApp opened for',
    'whatsapp.copied': 'Planning copied to clipboard!',
    'whatsapp.empty.all': 'No planning to send.',
    'whatsapp.no.providers': 'No provider with cleanings.',
    'whatsapp.title': 'Send via WhatsApp',
    'whatsapp.select': 'Click a provider:',

    // Share
    'share.save.first': 'Save configuration first.',
    'share.link.copied': 'Read-only link copied!',

    // Provider
    'provider.added': 'added',
    'provider.delete.confirm': 'Delete provider',
    'provider.link.copied': 'Provider link copied!',
    'provider.zone.define': 'Define zone',

    // Vacation
    'vacation.none': 'None',
    'vacation.title': 'Vacations for',
    'vacation.empty': 'No vacation period.',
    'vacation.dates.required': 'Select both dates.',
    'vacation.dates.invalid': 'Start date must be before end date.',

    // Linen
    'linen.name.required': 'Enter a name for the linen set.',
    'linen.duplicate': 'This set already exists.',
    'linen.empty': 'No linen set. Add one above.',
    'linen.status.available': 'Available',
    'linen.status.used': 'In use',
    'linen.status.pressing': 'At laundry',
    'linen.action.mark.used': 'Mark as used',
    'linen.action.send.pressing': 'Send to laundry',
    'linen.action.return': 'Return from laundry',
    'linen.last.used': 'Last used:',
    'linen.never.used': 'Never used',
    'linen.history.recent': 'Recent history',

    // iCal
    'ical.empty': 'No calendar configured',
    'ical.all.added': 'All platforms already added',
    'ical.choose.platform': 'Choose a platform:',
    'ical.add.title': 'Add a calendar',
    'ical.add.button': '+ Add a calendar',
    'ical.delete.confirm': 'Delete calendar',

    // Property
    'property.click.configure': 'Click ✏️ to configure the property',
    'property.type.apartment': 'Apartment',
    'property.type.house': 'House',
    'property.type.studio': 'Studio',
    'property.type.villa': 'Villa',
    'property.type.chalet': 'Chalet',
    'property.type.other': 'Other',
    'property.image.toolarge': 'Image too large (max 500 KB)',
    'property.checklist.empty': 'No instructions',
    'property.name.placeholder': 'Property name',
    'property.instruction.placeholder': 'New instruction...',

    // Time
    'time.today': 'today',
    'time.tomorrow': 'tomorrow',
    'time.in2days': 'in 2 days',

    // Notifications
    'notification.unsupported': 'Notifications not supported by this browser.',
    'notification.blocked': 'Notifications blocked. Allow them in browser settings.',
    'notification.denied': 'Notification permission denied.',
    'reminder.duplicate': 'Reminder already set for',
    'reminder.scheduled': 'Reminder set D-2 for',

    // Premium limits
    'premium.limit.providers': 'You reached the limit of {n} providers.',
    'premium.limit.properties': 'You reached the limit of {n} property(ies).',
    'premium.limit.icals': 'You reached the limit of {n} calendars.',
    'premium.limit.generations': 'Limit of {n} generations/day reached.',
    'premium.stats.locked': 'Charts and costs are reserved for Premium users',
    'premium.comm.locked': 'WhatsApp, PDF and Share are reserved for Premium users',
    'premium.history.locked': 'History and linens are reserved for Premium users',
    'premium.upgrade.text': 'Upgrade to Premium to unlock.',

    // Confirm
    'confirm.title': 'Confirm',
    'confirm.cancel': 'Cancel',
    'confirm.delete': 'Delete',

    // Changelog
    'changelog.title': 'Change history',
    'changelog.empty': 'No changes recorded.',
    'changelog.cleared': 'History cleared',

    // Send modal
    'send.btn': 'Send',
    'send.title': 'Send the planning',
    'send.copy': 'Copy text',

    // Calendar
    'calendar.legend.cleaning': 'Cleaning',
    'calendar.legend.reservation': 'Reservation',
    'calendar.today': 'Today',

    // Help tooltips
    'help.property': 'Configure your property: name, address, iCal calendars. Click ✏️ for details and 📍 for location.',
    'help.providers': 'Add your providers with their % split (total = 100%). Click 📍 to define their service zone.',
    'help.planning': 'Planning is generated automatically. Click Refresh to force update. Filter by provider.',
    'help.communication': 'Export as CSV or send via WhatsApp. Share a read-only link.',
    'help.history': 'Past cleanings are archived automatically. Manage your linens in the Pressing tab.',

    // Table headers (provider list)
    'table.name': 'Name',
    'table.phone': 'Phone',
    'table.pct': '%',
    'table.rate': 'Rate',
    'table.vacations': 'Vacations',
    'table.link': 'Link',

    // Results
    'results.empty.future': 'No upcoming cleanings.',
    'results.loading': 'Loading...',
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
