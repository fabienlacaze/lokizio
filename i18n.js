/**
 * i18n.js - Internationalization system for Lokizio
 * Supports French (fr) and English (en) with flag toggle.
 */
const I18N = {
  fr: {
    // Auth
    'auth.title': 'Lokizio',
    'auth.subtitle': 'Services et conciergerie pour locations',
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
    'auth.remember': 'Se souvenir de moi',
    'auth.forgot': 'Mot de passe oublie ?',
    'auth.reset.sent': 'Email de reinitialisation envoye ! Verifiez votre boite mail.',

    // Header
    'header.subtitle': 'Services et conciergerie',
    'header.share': 'Partager en lecture seule',
    'header.changelog': 'Historique modifications',
    'header.theme': 'Theme clair/sombre',
    'header.help': 'Aide',
    'header.logout': 'Deconnexion',

    // Install banner
    'install.title': 'Installer Lokizio',
    'install.subtitle': 'Acces rapide depuis l\'ecran d\'accueil',
    'install.btn': 'Installer',

    // Sections
    'section.property': 'Propriete',
    'section.team': 'Equipe active',
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
    'comm.provlinks': 'Liens prestataires',
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
    'share.save_first': 'Sauvegardez la configuration d\'abord pour generer le lien.',
    'ical.remove_confirm': 'Supprimer le calendrier',
    'btn.delete': 'Supprimer',
    'provider.remove_confirm': 'Supprimer le prestataire',
    'validate.pct': 'Le total des pourcentages doit etre 100%',
    'notif.blocked': 'Notifications bloquees. Autorisez-les dans les parametres du navigateur.',
    'notif.denied': 'Permission de notification refusee.',
    'error': 'Erreur',

    // Account
    'account.title': 'Mon compte',
    'account.new_password': 'Nouveau mot de passe (6 caracteres minimum) :',
    'account.pwd_short': 'Le mot de passe doit faire au moins 6 caracteres.',
    'account.pwd_changed': 'Mot de passe modifie !',
    'account.new_email': 'Nouvel email :',
    'account.email_sent': 'Email de confirmation envoye.',
    'account.delete_confirm': 'Etes-vous sur de vouloir supprimer votre compte ? Cette action est irreversible. Toutes vos donnees seront perdues.',
    'account.delete_btn': 'Supprimer definitivement',
    'account.delete_confirm2': 'Derniere chance ! Confirmez la suppression.',
    'account.deleted': 'Compte supprime.',
    'premium.upgrade': 'Passer a Premium',

    // Dashboard
    'dash.today': "Menages aujourd'hui",
    'dash.week': 'Cette semaine',
    'dash.properties': 'Proprietes',
    'dash.providers': 'Prestataires',
    'dash.no_today': "Aucun menage aujourd'hui",

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

    // Onboarding
    'onboarding.welcome': 'Bienvenue sur Lokizio !',
    'onboarding.role_question': 'Quel est votre profil ?',
    'onboarding.steps': 'Pour commencer :',
    'onboarding.step1': 'Renseignez le nom et collez les URLs iCal de vos plateformes (Airbnb, Booking...)',
    'onboarding.step2': 'Ajoutez vos prestataires avec leur % de repartition',
    'onboarding.step3': 'Il se genere automatiquement !',
    'onboarding.help': 'Cliquez ? a cote de chaque section pour plus d\'aide.',
    'onboarding.go': 'C\'est parti !',
    'onboarding.concierge.title': 'Mode Conciergerie',
    'onboarding.owner.title': 'Mode Proprietaire',
    'onboarding.provider.title': 'Mode Prestataire',
    'onboarding.provider.desc': 'Votre gestionnaire ou proprietaire vous a invite.',
    'onboarding.provider.features': 'Ce que vous pouvez faire :',

    // Roles
    'role.concierge.title': 'Je gere une conciergerie',
    'role.concierge.desc': 'Vous gerez les menages pour plusieurs proprietaires. Dashboard, facturation, gestion d\'equipe.',
    'role.owner.title': 'Je suis proprietaire',
    'role.owner.desc': 'Vous etes proprietaire et suivez les menages de vos biens.',
    'role.owner.plan': 'Gratuit (1 propriete) / Pro (3.99€/mois)',
    'role.provider.title': 'Je suis prestataire de menage',
    'role.provider.desc': 'Vous faites les menages. Consultez votre planning, validez vos interventions.',
    'role.provider.plan': 'Gratuit (invite par un gerant)',

    // Team
    'team.email_required': 'Email requis',
    'team.admin_only': 'Seuls les admins peuvent gerer l\'equipe',
    'team.invite_error': 'Erreur lors de l\'invitation',
    'team.remove_confirm': 'Retirer ce membre de l\'equipe ?',

    // KPI
    'kpi.properties': 'Proprietes',
    'kpi.upcoming': 'Prestations a venir',
    'kpi.this_week': 'Prestations cette semaine',
    'kpi.providers': 'Prestataires',
    'kpi.cost': 'Cout previsionnel',
    'kpi.upcoming_provider': 'A venir',
    'kpi.done': 'Termines',
    'kpi.remaining': 'Restants',

    // ═ New keys migrated from hardcoded strings (v9.18) ═
    'role.concierge.desc': 'Gerez les menages pour plusieurs proprietaires',
    'role.owner.desc': 'Suivez les menages de vos biens',
    'role.provider.desc': 'Consultez et validez vos missions',
    'role.tenant.desc': 'Suivez les interventions dans votre logement',
    'invite.email.required': 'Entrez un email.',
    'invite.property.required': 'Selectionnez un bien.',
    'invite.tenant.only_concierge_owner': 'Seul un concierge ou proprietaire peut inviter un locataire.',
    'invite.created': 'Invitation creee pour ',
    'invite.copy_message': 'Copier le message',
    'password.new': 'Nouveau mot de passe',
    'password.confirm': 'Confirmez le mot de passe',
    'password.show': 'Afficher le mot de passe',
    'password.rule.upper': 'Au moins une lettre majuscule requise',
    'password.rule.lower': 'Au moins une lettre minuscule requise',
    'password.rule.digit': 'Au moins un chiffre requis',
    'password.mismatch': 'Les mots de passe ne correspondent pas',
    'account.update_failed': 'Impossible de mettre a jour',
    'account.delete.confirm_text': 'JE CONFIRME LA SUPPRESSION',
    'admin.prestation.disputed': 'Conteste par le proprietaire',
    'auth.network_error': 'Erreur de connexion. Verifiez votre reseau.',
    'billing.quote_before': 'Emettre un devis pour validation avant prestation',
    'billing.invoice_target': 'A qui envoyer cette facture ?',
    'billing.concierge_to_owner.desc': 'Factures que vous envoyez a vos proprietaires pour les prestations realisees',
    'billing.provider_to_concierge.desc': 'Factures recues de vos prestataires pour leurs interventions',
    'billing.trigger_now': 'Declencher la generation maintenant',
    'billing.to_concierge': 'A la conciergerie',
    'invoice.for_owner': 'Pour le proprietaire',
    'invoice.for_concierge': 'Pour la conciergerie',
    'invoice.create_quote': 'Creer un devis',
    'invoice.create_invoice': 'Creer une facture',
    'invoice.quote_lines': 'Lignes du devis',
    'invoice.lines': 'Lignes de facture',
    'invoice.conditions_placeholder': 'Conditions particulieres, modalites de paiement...',
    'invoice.prestations_of': 'Prestations de ',
    'invoice.convert_quote': 'Convertir ce devis en facture',
    'invoice.period.this_year': 'Cette annee',
    'invoice.send_reminder': 'Envoyer une relance au client ?',
    'invoice.view_detail': 'Voir le detail',
    'invoice.delete_confirm': 'Supprimer cette facture ?',
    'invoice.email_body': 'Bonjour, veuillez trouver ci-joint la facture...',
    'invoice.vat.exempt_notice': 'TVA non applicable, art. 293B du CGI',
    'invoice.quote.accept_confirm': 'Marquer ce devis comme accepte par le client ?',
    'invoice.quote.refuse_confirm': 'Marquer ce devis comme refuse par le client ?',
    'invoice.quote.convert_confirm': 'Convertir ce devis en facture ? Le devis sera marque comme accepte.',
    'legal.vat.exempt_placeholder': 'Non applicable - TVA non applicable, art. 293 B du CGI',
    'legal.company_name.label': 'Nom complet ou raison sociale',
    'legal.rgpd_email.label': 'Email de contact RGPD',
    'legal.address.label': 'Adresse du siege',
    'marketplace.already_connected_with': 'Vous etes deja connecte avec ',
    'marketplace.goal.collaborate': 'Collaborer sur des prestations',
    'marketplace.goal.request_service': 'Demander un service pour mes biens',
    'marketplace.cancel_request': 'Annuler votre demande de connexion',
    'marketplace.city_or_postal': 'Ville ou code postal...',
    'marketplace.avg_rating': 'Note moyenne de ',
    'marketplace.no_organized_prestations': 'Aucune prestation organisee a ce jour via Lokizio.',
    'marketplace.no_validated_prestations': 'Aucune prestation validee a ce jour via Lokizio.',
    'marketplace.registered_since': 'Inscrit sur Lokizio depuis le ',
    'marketplace.on_vacation': 'Actuellement en conges, ne prendra pas de nouvelles missions.',
    'marketplace.concierge_accepts_new': 'Cette conciergerie accepte de nouveaux proprietaires et prestataires.',
    'marketplace.owner_seeks_services': 'Ce proprietaire cherche des services pour ses biens.',
    'marketplace.provider_available': 'Ce prestataire est disponible pour de nouvelles missions.',
    'marketplace.cancel_my_request': 'Annuler la demande',
    'marketplace.all_profiles': 'Tous les profils',
    'marketplace.premium_required_connect': 'Passez Premium pour vous connecter.',
    'owner.address_directions': 'Indications pour arriver...',
    'chat.waiting_answer': 'En attente de reponse',
    'chat.write_message': 'Ecrire un message...',
    'property.notes_placeholder': 'Notes sur la propriete...',
    'property.delete_confirm': 'Supprimer ce bien et toutes ses donnees ?',
    'property.remove_service_confirm': 'Retirer ce service du bien ?',
    'tenant.home_title': 'Votre logement',
    'tenant.key_handover': 'Remise de cles',
    'ical.source.gites_france': 'Gites de France',
  },

  en: {
    // Auth
    'auth.title': 'Lokizio',
    'auth.subtitle': 'Services & concierge for rentals',
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
    'auth.remember': 'Remember me',
    'auth.forgot': 'Forgot password?',
    'auth.reset.sent': 'Reset email sent! Check your inbox.',

    // Header
    'header.subtitle': 'Services & concierge',
    'header.share': 'Share read-only link',
    'header.changelog': 'Change log',
    'header.theme': 'Light/dark theme',
    'header.help': 'Help',
    'header.logout': 'Sign out',

    // Install banner
    'install.title': 'Install Lokizio',
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
    'section.team': 'Active team',
    'section.history': 'History & Linens',

    // Communication & Export
    'comm.title': 'Communication & Export',
    'comm.share': 'Share (read-only)',
    'comm.provlinks': 'Provider links',
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
    'share.save_first': 'Save configuration first to generate the link.',
    'ical.remove_confirm': 'Remove calendar',
    'btn.delete': 'Delete',
    'provider.remove_confirm': 'Remove provider',

    // Account
    'account.title': 'My account',
    'account.new_password': 'New password (6 characters minimum):',
    'account.pwd_short': 'Password must be at least 6 characters.',
    'account.pwd_changed': 'Password changed!',
    'account.new_email': 'New email:',
    'account.email_sent': 'Confirmation email sent.',
    'account.delete_confirm': 'Are you sure you want to delete your account? This action is irreversible. All your data will be lost.',
    'account.delete_btn': 'Delete permanently',
    'account.delete_confirm2': 'Last chance! Confirm deletion.',
    'account.deleted': 'Account deleted.',
    'premium.upgrade': 'Upgrade to Premium',

    // Dashboard
    'dash.today': 'Cleanings today',
    'dash.week': 'This week',
    'dash.properties': 'Properties',
    'dash.providers': 'Providers',
    'dash.no_today': 'No cleaning today',
    'validate.pct': 'Total must be 100%',
    'notif.blocked': 'Notifications blocked. Enable them in browser settings.',
    'notif.denied': 'Notification permission denied.',
    'error': 'Error',
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

    // Onboarding
    'onboarding.welcome': 'Welcome to Lokizio!',
    'onboarding.role_question': 'What is your profile?',
    'onboarding.steps': 'To get started:',
    'onboarding.step1': 'Enter the name and paste iCal URLs from your platforms (Airbnb, Booking...)',
    'onboarding.step2': 'Add your providers with their % distribution',
    'onboarding.step3': 'It generates automatically!',
    'onboarding.help': 'Click ? next to each section for more help.',
    'onboarding.go': 'Let\'s go!',
    'onboarding.concierge.title': 'Concierge Mode',
    'onboarding.owner.title': 'Owner Mode',
    'onboarding.provider.title': 'Provider Mode',
    'onboarding.provider.desc': 'Your manager or owner has invited you.',
    'onboarding.provider.features': 'What you can do:',

    // Roles
    'role.concierge.title': 'I manage a concierge service',
    'role.concierge.desc': 'You manage cleanings for multiple property owners. Dashboard, billing, team management.',
    'role.owner.title': 'I am a property owner',
    'role.owner.desc': 'You own properties and track their cleaning status.',
    'role.owner.plan': 'Free (1 property) / Pro ($3.99/month)',
    'role.provider.title': 'I am a cleaning provider',
    'role.provider.desc': 'You do the cleanings. View your schedule, validate your work.',
    'role.provider.plan': 'Free (invited by a manager)',

    // Team
    'team.email_required': 'Email required',
    'team.admin_only': 'Only admins can manage the team',
    'team.invite_error': 'Error sending invitation',
    'team.remove_confirm': 'Remove this member from the team?',

    // KPI
    'kpi.properties': 'Properties',
    'kpi.upcoming': 'Upcoming cleanings',
    'kpi.this_week': 'Services this week',
    'kpi.providers': 'Providers',
    'kpi.cost': 'Estimated cost',
    'kpi.upcoming_provider': 'Upcoming',
    'kpi.done': 'Done',
    'kpi.remaining': 'Remaining',

    // ═ New keys migrated from hardcoded strings (v9.18) ═
    'role.concierge.desc': 'Manage cleaning for multiple owners',
    'role.owner.desc': 'Track cleaning for your properties',
    'role.provider.desc': 'View and validate your missions',
    'role.tenant.desc': 'Track interventions in your home',
    'invite.email.required': 'Enter an email.',
    'invite.property.required': 'Select a property.',
    'invite.tenant.only_concierge_owner': 'Only a concierge or owner can invite a tenant.',
    'invite.created': 'Invitation created for ',
    'invite.copy_message': 'Copy message',
    'password.new': 'New password',
    'password.confirm': 'Confirm password',
    'password.show': 'Show password',
    'password.rule.upper': 'At least one uppercase letter required',
    'password.rule.lower': 'At least one lowercase letter required',
    'password.rule.digit': 'At least one digit required',
    'password.mismatch': 'Passwords do not match',
    'account.update_failed': 'Unable to update',
    'account.delete.confirm_text': 'I CONFIRM THE DELETION',
    'admin.prestation.disputed': 'Disputed by the owner',
    'auth.network_error': 'Connection error. Check your network.',
    'billing.quote_before': 'Issue a quote for validation before service',
    'billing.invoice_target': 'Who to send this invoice to?',
    'billing.concierge_to_owner.desc': 'Invoices you send to your owners for services provided',
    'billing.provider_to_concierge.desc': 'Invoices received from your providers for their interventions',
    'billing.trigger_now': 'Trigger generation now',
    'billing.to_concierge': 'To the concierge',
    'invoice.for_owner': 'For the owner',
    'invoice.for_concierge': 'For the concierge',
    'invoice.create_quote': 'Create quote',
    'invoice.create_invoice': 'Create invoice',
    'invoice.quote_lines': 'Quote lines',
    'invoice.lines': 'Invoice lines',
    'invoice.conditions_placeholder': 'Special conditions, payment terms...',
    'invoice.prestations_of': 'Services for ',
    'invoice.convert_quote': 'Convert this quote to invoice',
    'invoice.period.this_year': 'This year',
    'invoice.send_reminder': 'Send a reminder to the client?',
    'invoice.view_detail': 'View details',
    'invoice.delete_confirm': 'Delete this invoice?',
    'invoice.email_body': 'Hello, please find attached the invoice...',
    'invoice.vat.exempt_notice': 'VAT not applicable, art. 293B CGI',
    'invoice.quote.accept_confirm': 'Mark this quote as accepted by client?',
    'invoice.quote.refuse_confirm': 'Mark this quote as refused by client?',
    'invoice.quote.convert_confirm': 'Convert quote to invoice? The quote will be marked as accepted.',
    'legal.vat.exempt_placeholder': 'Not applicable - VAT not applicable, art. 293 B CGI',
    'legal.company_name.label': 'Full name or company name',
    'legal.rgpd_email.label': 'RGPD contact email',
    'legal.address.label': 'Head office address',
    'marketplace.already_connected_with': 'You are already connected with ',
    'marketplace.goal.collaborate': 'Collaborate on services',
    'marketplace.goal.request_service': 'Request a service for my properties',
    'marketplace.cancel_request': 'Cancel your connection request',
    'marketplace.city_or_postal': 'City or postal code...',
    'marketplace.avg_rating': 'Average rating of ',
    'marketplace.no_organized_prestations': 'No services organized to date via Lokizio.',
    'marketplace.no_validated_prestations': 'No services validated to date via Lokizio.',
    'marketplace.registered_since': 'Registered on Lokizio since ',
    'marketplace.on_vacation': 'Currently on leave, will not accept new missions.',
    'marketplace.concierge_accepts_new': 'This concierge accepts new owners and providers.',
    'marketplace.owner_seeks_services': 'This owner is looking for services for their properties.',
    'marketplace.provider_available': 'This provider is available for new missions.',
    'marketplace.cancel_my_request': 'Cancel request',
    'marketplace.all_profiles': 'All profiles',
    'marketplace.premium_required_connect': 'Upgrade to Premium to connect.',
    'owner.address_directions': 'Directions to arrive...',
    'chat.waiting_answer': 'Waiting for answer',
    'chat.write_message': 'Write a message...',
    'property.notes_placeholder': 'Notes about the property...',
    'property.delete_confirm': 'Delete this property and all its data?',
    'property.remove_service_confirm': 'Remove this service from the property?',
    'tenant.home_title': 'Your home',
    'tenant.key_handover': 'Key handover',
    'ical.source.gites_france': 'Gites de France',
  },

  // ═══ ESPAÑOL ═══
  es: {
    'auth.title': 'Lokizio', 'auth.subtitle': 'Gestion de limpieza de alquileres',
    'auth.tab.login': 'Iniciar sesion', 'auth.tab.register': 'Crear cuenta',
    'auth.email': 'Email', 'auth.password': 'Contrasena', 'auth.password.placeholder': '6 caracteres minimo',
    'auth.login.btn': 'Iniciar sesion', 'auth.register.btn': 'Crear mi cuenta',
    'auth.fill.all': 'Complete todos los campos', 'auth.pass.short': 'La contrasena debe tener al menos 6 caracteres',
    'auth.pass.mismatch': 'Las contrasenas no coinciden', 'auth.logout.confirm': 'Cerrar sesion?',
    'header.subtitle': 'Gestion de limpieza', 'section.property': 'Propiedad', 'section.team': 'Equipo de limpieza',
    'section.history': 'Historial y Lavanderia', 'config.ical': 'Calendarios iCal',
    'config.providers': 'Proveedores', 'config.name': 'Nombre', 'config.phone': 'Telefono', 'config.price': 'Tarifa',
    'config.add': '+ Agregar', 'provider.add.title': 'Agregar proveedor',
    'generate.btn': 'GENERAR PLANIFICACION', 'generate.refresh': 'Actualizar',
    'generate.loading': 'Generando...', 'generate.success': 'Planificacion generada con exito',
    'results.title': 'Planificacion', 'results.tab.list': 'Lista', 'results.tab.calendar': 'Calendario', 'results.tab.stats': 'Estadisticas',
    'results.tab.history': 'Historial', 'results.tab.pressing': 'Lavanderia',
    'results.csv': 'CSV', 'results.pdf': 'PDF', 'results.copy': 'Copiar',
    'comm.title': 'Comunicacion y Exportacion', 'comm.share': 'Compartir',
    'send.btn': 'Enviar', 'send.title': 'Enviar planificacion', 'send.copy': 'Copiar texto',
    'premium.title': 'Actualizar a Premium', 'premium.subtitle': 'Proveedores ilimitados, sin publicidad',
    'premium.btn': 'Ver ofertas', 'premium.modal.title': 'Elija su plan',
    'premium.plan.free': 'Gratis', 'premium.plan.current': 'Plan actual', 'premium.btn.upgrade': 'Actualizar a Premium',
    'premium.cancel': 'Cancelable en cualquier momento. Pago seguro por Stripe.',
    'table.source': 'Fuente', 'table.checkin': 'Llegada', 'table.checkout': 'Salida',
    'table.interval': 'Intervalo', 'table.cleaning': 'Limpieza el', 'table.provider': 'Proveedor',
    'property.label': 'Propiedad:', 'property.add': '+ Agregar',
    'prop.detail.title': 'Detalles de la propiedad', 'prop.detail.name': 'Nombre', 'prop.detail.address': 'Direccion',
    'prop.detail.type': 'Tipo', 'prop.detail.rooms': 'Habitaciones', 'prop.detail.price': 'Tarifa limpieza (€)',
    'prop.detail.duration': 'Duracion estimada', 'prop.detail.checklist': 'Instrucciones de limpieza',
    'prop.detail.notes': 'Notas', 'prop.detail.save': 'Guardar',
    'map.radius': 'Radio:', 'map.save': 'Guardar', 'map.not_found': 'Direccion no encontrada',
    'modal.close': 'Cerrar', 'modal.ok': 'OK',
    'status.ready': 'Listo', 'status.restored': 'Planificacion restaurada',
    'ad.label': 'Publicidad', 'calendar.today': 'Hoy',
    'install.title': 'Instalar Lokizio', 'install.btn': 'Instalar',
    'install.subtitle': 'Acceso rapido desde la pantalla de inicio',

    // Auth (missing)
    'auth.confirm': 'Confirmar contrasena',
    'auth.confirm.placeholder': 'Vuelva a escribir la contrasena',
    'auth.register.loading': 'Creacion en curso...',
    'auth.pass.min': 'La contrasena debe tener al menos 6 caracteres',
    'auth.email.taken': 'Este email ya esta en uso',
    'auth.login.invalid': 'Email o contrasena incorrectos',
    'auth.register.success': 'Cuenta creada!',
    'auth.register.check_email': 'Se ha enviado un email de confirmacion a <b>{email}</b>.<br>Haga clic en el enlace del email y luego vuelva a iniciar sesion.',
    'auth.register.connecting': 'Cuenta creada! Conexion...',
    'auth.remember': 'Recordarme',
    'auth.forgot': 'Contrasena olvidada?',
    'auth.reset.sent': 'Email de restablecimiento enviado! Revise su bandeja de entrada.',

    // Header (missing)
    'header.share': 'Compartir en solo lectura',
    'header.changelog': 'Historial de modificaciones',
    'header.theme': 'Tema claro/oscuro',
    'header.help': 'Ayuda',
    'header.logout': 'Desconexion',

    // Config (missing)
    'config.title': 'Configuracion',
    'config.ical.airbnb': 'URL iCal Airbnb...',
    'config.ical.booking': 'URL iCal Booking...',
    'config.paste': 'Pegar',
    'config.pct': '%',

    // Generate (missing)
    'generate.title': 'Generar',
    'generate.save': 'Guardar configuracion',

    // Map (missing)
    'map.provider_zone': 'Zona de',
    'map.property_location': 'Posicion de',
    'map.saved': 'Posicion guardada para',
    'map.search': 'Buscar una direccion...',

    // Comm (missing)
    'comm.provlinks': 'Enlaces proveedores',
    'comm.export': 'Exportar',

    // Results (missing)
    'results.empty': 'Haga clic en GENERAR PLANIFICACION para mostrar las limpiezas',
    'results.whatsapp': 'WhatsApp',
    'results.clear_history': 'Borrar el historial',

    // Stats (missing)
    'stats.empty': 'Genere una planificacion para ver las estadisticas.',

    // Modals (missing)
    'modal.vacations': 'Vacaciones del proveedor',

    // Help (missing)
    'help.title': 'Ayuda',
    'help.config.title': '1. Configuracion',
    'help.config.text': 'Pegue las URLs iCal de Airbnb y Booking. Agregue sus proveedores con su porcentaje (total = 100%).',
    'help.planning.title': '2. Planificacion',
    'help.planning.text': 'Haga clic en GENERAR para descargar los calendarios y asignar las limpiezas automaticamente.',
    'help.results.title': '3. Resultados',
    'help.results.text': 'Cambie los proveedores, filtre, marque "Transmitido" para las fechas enviadas.',
    'help.features': 'Funcionalidades',
    'help.feature.persist': 'modificaciones guardadas automaticamente.',
    'help.feature.whatsapp': 'envie la planificacion a cada proveedor.',
    'help.feature.calendar': 'vista mensual con limpiezas y reservas.',
    'help.feature.stats': 'graficos de distribucion por proveedor.',
    'help.feature.history': 'las limpiezas pasadas se archivan.',
    'help.feature.notif': 'alertas 2 dias antes de llegada/salida.',
    'help.feature.link': 'comparta un enlace de solo lectura.',

    // Nav (missing)
    'nav.config': 'Config',
    'nav.generate': 'Generar',
    'nav.results': 'Planificacion',
    'nav.stats': 'Estadisticas',
    'nav.more': 'Mas',

    // Properties (missing)
    'property.name_prompt': 'Nombre de la propiedad:',
    'property.remove_confirm': 'Eliminar',

    // Premium (missing)
    'premium.free.property': '1 propiedad',
    'premium.free.providers': '2 proveedores maximo',
    'premium.free.ical': 'Calendario iCal',
    'premium.free.ads': 'Publicidad',
    'premium.feat.properties': 'Propiedades ilimitadas',
    'premium.feat.providers': 'Proveedores ilimitados',
    'premium.feat.noads': 'Sin publicidad',
    'premium.feat.priority': 'Soporte prioritario',
    'premium.feat.export': 'Exportacion PDF avanzada',
    'premium.stripe.pending': 'El pago estara disponible pronto. Contactenos para un acceso anticipado!',
    'ad.remove': 'Eliminar la publicidad',

    // Validation (missing)
    'validation.name.required': 'Por favor ingrese un nombre.',
    'config.ical.required': 'Ingrese al menos una URL iCal.',
    'config.provider.required': 'Agregue al menos un proveedor.',
    'config.percentages.invalid': 'El total de los porcentajes debe ser 100%',
    'config.saved': 'Configuracion guardada',

    // Generate (missing)
    'generate.remaining': 'quedan {n} generacion(es) gratuita(s)',

    // Export (missing)
    'export.empty': 'Ninguna planificacion para exportar.',
    'export.filter.empty': 'Ninguna limpieza con este filtro.',
    'export.csv.success': 'CSV exportado: {n} limpieza(s)',
    'export.pdf.success': 'PDF exportado: {n} limpieza(s)',
    'export.pdf.title': 'Planificacion de limpiezas',
    'export.pdf.generated': 'Generado el',
    'export.text.copied': 'Planificacion copiada',

    // WhatsApp (missing)
    'whatsapp.empty': 'Ninguna limpieza para',
    'whatsapp.opened': 'Copiado + WhatsApp abierto para',
    'whatsapp.copied': 'Planificacion copiada al portapapeles!',
    'whatsapp.empty.all': 'Ninguna planificacion para enviar.',
    'whatsapp.no.providers': 'Ningun proveedor con limpiezas.',
    'whatsapp.title': 'Enviar por WhatsApp',
    'whatsapp.select': 'Haga clic en un proveedor:',

    // Share (missing)
    'share.save.first': 'Guarde la configuracion primero.',
    'share.link.copied': 'Enlace de solo lectura copiado!',

    // Provider (missing)
    'provider.added': 'agregado',
    'provider.delete.confirm': 'Eliminar el proveedor',
    'provider.link.copied': 'Enlace del proveedor copiado!',
    'provider.zone.define': 'Definir la zona',

    // Vacation (missing)
    'vacation.none': 'Ninguna',
    'vacation.title': 'Vacaciones de',
    'vacation.empty': 'Ningun periodo de vacaciones.',
    'share.save_first': 'Guarde la configuracion primero para generar el enlace.',
    'ical.remove_confirm': 'Eliminar el calendario',
    'btn.delete': 'Eliminar',
    'provider.remove_confirm': 'Eliminar el proveedor',
    'validate.pct': 'El total de los porcentajes debe ser 100%',
    'notif.blocked': 'Notificaciones bloqueadas. Autorícelas en los ajustes del navegador.',
    'notif.denied': 'Permiso de notificacion denegado.',
    'error': 'Error',

    // Account (missing)
    'account.title': 'Mi cuenta',
    'account.new_password': 'Nueva contrasena (6 caracteres minimo):',
    'account.pwd_short': 'La contrasena debe tener al menos 6 caracteres.',
    'account.pwd_changed': 'Contrasena modificada!',
    'account.new_email': 'Nuevo email:',
    'account.email_sent': 'Email de confirmacion enviado.',
    'account.delete_confirm': 'Esta seguro de que desea eliminar su cuenta? Esta accion es irreversible. Todos sus datos se perderan.',
    'account.delete_btn': 'Eliminar definitivamente',
    'account.delete_confirm2': 'Ultima oportunidad! Confirme la eliminacion.',
    'account.deleted': 'Cuenta eliminada.',
    'premium.upgrade': 'Pasar a Premium',

    // Dashboard (missing)
    'dash.today': 'Limpiezas de hoy',
    'dash.week': 'Esta semana',
    'dash.properties': 'Propiedades',
    'dash.providers': 'Proveedores',
    'dash.no_today': 'Ninguna limpieza hoy',

    'vacation.dates.required': 'Seleccione ambas fechas.',
    'vacation.dates.invalid': 'La fecha de inicio debe ser anterior a la de fin.',

    // Linen (missing)
    'linen.name.required': 'Ingrese un nombre para el juego de ropa.',
    'linen.duplicate': 'Este juego ya existe.',
    'linen.empty': 'Ningun juego de ropa. Agregue uno arriba.',
    'linen.status.available': 'Disponible',
    'linen.status.used': 'En uso',
    'linen.status.pressing': 'En lavanderia',
    'linen.action.mark.used': 'Marcar como usado',
    'linen.action.send.pressing': 'Enviar a lavanderia',
    'linen.action.return': 'Retorno de lavanderia',
    'linen.last.used': 'Ultimo uso:',
    'linen.never.used': 'Nunca usado',
    'linen.history.recent': 'Historial reciente',

    // iCal (missing)
    'ical.empty': 'Ningun calendario configurado',
    'ical.all.added': 'Todas las plataformas ya estan agregadas',
    'ical.choose.platform': 'Elegir una plataforma:',
    'ical.add.title': 'Agregar un calendario',
    'ical.add.button': '+ Agregar un calendario',
    'ical.delete.confirm': 'Eliminar el calendario',

    // Property (missing)
    'property.click.configure': 'Haga clic en ✏️ para configurar la propiedad',
    'property.type.apartment': 'Apartamento',
    'property.type.house': 'Casa',
    'property.type.studio': 'Estudio',
    'property.type.villa': 'Villa',
    'property.type.chalet': 'Chalet',
    'property.type.other': 'Otro',
    'property.image.toolarge': 'Imagen demasiado grande (max 500 Ko)',
    'property.checklist.empty': 'Ninguna instruccion',
    'property.name.placeholder': 'Nombre del alojamiento',
    'property.instruction.placeholder': 'Nueva instruccion...',

    // Time (missing)
    'time.today': 'hoy',
    'time.tomorrow': 'manana',
    'time.in2days': 'en 2 dias',

    // Notifications (missing)
    'notification.unsupported': 'Notificaciones no soportadas por este navegador.',
    'notification.blocked': 'Notificaciones bloqueadas. Autorícelas en los ajustes.',
    'notification.denied': 'Permiso de notificacion denegado.',
    'reminder.duplicate': 'Recordatorio ya programado para',
    'reminder.scheduled': 'Recordatorio programado J-2 para',

    // Premium limits (missing)
    'premium.limit.providers': 'Ha alcanzado el limite de {n} proveedores.',
    'premium.limit.properties': 'Ha alcanzado el limite de {n} propiedad(es).',
    'premium.limit.icals': 'Ha alcanzado el limite de {n} calendarios.',
    'premium.limit.generations': 'Limite de {n} generaciones/dia alcanzado.',
    'premium.stats.locked': 'Los graficos y costes estan reservados para usuarios Premium',
    'premium.comm.locked': 'WhatsApp, PDF y Compartir estan reservados para usuarios Premium',
    'premium.history.locked': 'El historial y la lavanderia estan reservados para usuarios Premium',
    'premium.upgrade.text': 'Pase a Premium para desbloquear.',

    // Confirm (missing)
    'confirm.title': 'Confirmar',
    'confirm.cancel': 'Cancelar',
    'confirm.delete': 'Eliminar',

    // Changelog (missing)
    'changelog.title': 'Historial de modificaciones',
    'changelog.empty': 'Ninguna modificacion registrada.',
    'changelog.cleared': 'Historial borrado',

    // Calendar (missing)
    'calendar.legend.cleaning': 'Limpieza',
    'calendar.legend.reservation': 'Reserva',

    // Help tooltips (missing)
    'help.property': 'Configure su alojamiento: nombre, direccion, calendarios iCal. Haga clic en ✏️ para los detalles y 📍 para la posicion.',
    'help.providers': 'Agregue sus proveedores con su % de distribucion (total = 100%). Haga clic en 📍 para definir su zona de accion.',
    'help.planning': 'La planificacion se genera automaticamente. Haga clic en Actualizar para forzar la actualizacion. Filtre por proveedor.',
    'help.communication': 'Exporte en CSV o envie por WhatsApp. Comparta un enlace de solo lectura.',
    'help.history': 'Las limpiezas pasadas se archivan automaticamente. Gestione sus juegos de ropa en Lavanderia.',

    // Table headers provider list (missing)
    'table.name': 'Nombre',
    'table.phone': 'Tel',
    'table.pct': '%',
    'table.rate': 'Tarifa',
    'table.vacations': 'Vacaciones',
    'table.link': 'Enlace',

    // Results (missing)
    'results.empty.future': 'Ninguna limpieza por venir.',
    'results.loading': 'Cargando...',

    // Onboarding (missing)
    'onboarding.welcome': 'Bienvenido a Lokizio!',
    'onboarding.role_question': 'Cual es su perfil?',
    'onboarding.steps': 'Para comenzar:',
    'onboarding.step1': 'Ingrese el nombre y pegue las URLs iCal de sus plataformas (Airbnb, Booking...)',
    'onboarding.step2': 'Agregue sus proveedores con su % de distribucion',
    'onboarding.step3': 'Se genera automaticamente!',
    'onboarding.help': 'Haga clic en ? junto a cada seccion para mas ayuda.',
    'onboarding.go': 'Vamos!',
    'onboarding.concierge.title': 'Modo Conserjeria',
    'onboarding.owner.title': 'Modo Propietario',
    'onboarding.provider.title': 'Modo Proveedor',
    'onboarding.provider.desc': 'Su gestor o propietario le ha invitado.',
    'onboarding.provider.features': 'Lo que puede hacer:',

    // Roles (missing)
    'role.concierge.title': 'Gestiono una conserjeria',
    'role.concierge.desc': 'Gestiona las limpiezas para varios propietarios. Dashboard, facturacion, gestion de equipo.',
    'role.owner.title': 'Soy propietario',
    'role.owner.desc': 'Es propietario y sigue las limpiezas de sus bienes.',
    'role.owner.plan': 'Gratis (1 propiedad) / Pro (3.99€/mes)',
    'role.provider.title': 'Soy proveedor de limpieza',
    'role.provider.desc': 'Realiza las limpiezas. Consulte su planificacion, valide sus intervenciones.',
    'role.provider.plan': 'Gratis (invitado por un gestor)',

    // Team (missing)
    'team.email_required': 'Email requerido',
    'team.admin_only': 'Solo los administradores pueden gestionar el equipo',
    'team.invite_error': 'Error al enviar la invitacion',
    'team.remove_confirm': 'Retirar este miembro del equipo?',

    // KPI (missing)
    'kpi.properties': 'Propiedades',
    'kpi.upcoming': 'Prestaciones por venir',
    'kpi.this_week': 'Esta semana',
    'kpi.providers': 'Proveedores',
    'kpi.cost': 'Coste previsional',
    'kpi.upcoming_provider': 'Por venir',
    'kpi.done': 'Terminados',
    'kpi.remaining': 'Restantes',

    // Prop detail (missing)
    'prop.detail.saved': 'Propiedad guardada',
  },

  // ═══ PORTUGUES ═══
  pt: {
    'auth.title': 'Lokizio', 'auth.subtitle': 'Gestao de limpeza de alugueis',
    'auth.tab.login': 'Entrar', 'auth.tab.register': 'Criar conta',
    'auth.email': 'Email', 'auth.password': 'Senha', 'auth.password.placeholder': '6 caracteres minimo',
    'auth.login.btn': 'Entrar', 'auth.register.btn': 'Criar minha conta',
    'auth.fill.all': 'Preencha todos os campos', 'auth.pass.short': 'A senha deve ter pelo menos 6 caracteres',
    'auth.pass.mismatch': 'As senhas nao coincidem', 'auth.logout.confirm': 'Sair?',
    'header.subtitle': 'Gestao de limpeza', 'section.property': 'Propriedade', 'section.team': 'Equipe de limpeza',
    'section.history': 'Historico e Lavanderia', 'config.ical': 'Calendarios iCal',
    'config.providers': 'Fornecedores', 'config.name': 'Nome', 'config.phone': 'Telefone', 'config.price': 'Tarifa',
    'config.add': '+ Adicionar', 'provider.add.title': 'Adicionar fornecedor',
    'generate.btn': 'GERAR PLANEJAMENTO', 'generate.refresh': 'Atualizar',
    'generate.loading': 'Gerando...', 'generate.success': 'Planejamento gerado com sucesso',
    'results.title': 'Planejamento', 'results.tab.list': 'Lista', 'results.tab.calendar': 'Calendario', 'results.tab.stats': 'Estatisticas',
    'results.tab.history': 'Historico', 'results.tab.pressing': 'Lavanderia',
    'results.csv': 'CSV', 'results.pdf': 'PDF', 'results.copy': 'Copiar',
    'comm.title': 'Comunicacao e Exportacao', 'comm.share': 'Compartilhar',
    'send.btn': 'Enviar', 'send.title': 'Enviar planejamento', 'send.copy': 'Copiar texto',
    'premium.title': 'Atualizar para Premium', 'premium.subtitle': 'Fornecedores ilimitados, sem publicidade',
    'premium.btn': 'Ver ofertas', 'premium.modal.title': 'Escolha seu plano',
    'premium.plan.free': 'Gratis', 'premium.plan.current': 'Plano atual', 'premium.btn.upgrade': 'Atualizar para Premium',
    'premium.cancel': 'Cancelavel a qualquer momento. Pagamento seguro por Stripe.',
    'table.source': 'Fonte', 'table.checkin': 'Chegada', 'table.checkout': 'Saida',
    'table.interval': 'Intervalo', 'table.cleaning': 'Limpeza em', 'table.provider': 'Fornecedor',
    'property.label': 'Propriedade:', 'property.add': '+ Adicionar',
    'prop.detail.title': 'Detalhes da propriedade', 'prop.detail.name': 'Nome', 'prop.detail.address': 'Endereco',
    'prop.detail.type': 'Tipo', 'prop.detail.rooms': 'Quartos', 'prop.detail.price': 'Tarifa limpeza (€)',
    'prop.detail.duration': 'Duracao estimada', 'prop.detail.checklist': 'Instrucoes de limpeza',
    'prop.detail.notes': 'Notas', 'prop.detail.save': 'Salvar',
    'map.radius': 'Raio:', 'map.save': 'Salvar', 'map.not_found': 'Endereco nao encontrado',
    'modal.close': 'Fechar', 'modal.ok': 'OK',
    'status.ready': 'Pronto', 'status.restored': 'Planejamento restaurado',
    'ad.label': 'Publicidade', 'calendar.today': 'Hoje',
    'install.title': 'Instalar Lokizio', 'install.btn': 'Instalar',
    'install.subtitle': 'Acesso rapido a partir da tela inicial',

    // Auth (missing)
    'auth.confirm': 'Confirmar a senha',
    'auth.confirm.placeholder': 'Digite a senha novamente',
    'auth.register.loading': 'Criacao em andamento...',
    'auth.pass.min': 'A senha deve ter pelo menos 6 caracteres',
    'auth.email.taken': 'Este email ja esta em uso',
    'auth.login.invalid': 'Email ou senha incorretos',
    'auth.register.success': 'Conta criada!',
    'auth.register.check_email': 'Um email de confirmacao foi enviado para <b>{email}</b>.<br>Clique no link do email e volte para fazer login.',
    'auth.register.connecting': 'Conta criada! Conectando...',
    'auth.remember': 'Lembrar de mim',
    'auth.forgot': 'Esqueceu a senha?',
    'auth.reset.sent': 'Email de redefinicao enviado! Verifique sua caixa de entrada.',

    // Header (missing)
    'header.share': 'Compartilhar em somente leitura',
    'header.changelog': 'Historico de modificacoes',
    'header.theme': 'Tema claro/escuro',
    'header.help': 'Ajuda',
    'header.logout': 'Desconexao',

    // Config (missing)
    'config.title': 'Configuracao',
    'config.ical.airbnb': 'URL iCal Airbnb...',
    'config.ical.booking': 'URL iCal Booking...',
    'config.paste': 'Colar',
    'config.pct': '%',

    // Generate (missing)
    'generate.title': 'Gerar',
    'generate.save': 'Salvar configuracao',

    // Map (missing)
    'map.provider_zone': 'Zona de',
    'map.property_location': 'Posicao de',
    'map.saved': 'Posicao salva para',
    'map.search': 'Pesquisar um endereco...',

    // Comm (missing)
    'comm.provlinks': 'Links dos fornecedores',
    'comm.export': 'Exportar',

    // Results (missing)
    'results.empty': 'Clique em GERAR PLANEJAMENTO para exibir as limpezas',
    'results.whatsapp': 'WhatsApp',
    'results.clear_history': 'Apagar o historico',

    // Stats (missing)
    'stats.empty': 'Gere um planejamento para ver as estatisticas.',

    // Modals (missing)
    'modal.vacations': 'Ferias do fornecedor',

    // Help (missing)
    'help.title': 'Ajuda',
    'help.config.title': '1. Configuracao',
    'help.config.text': 'Cole as URLs iCal do Airbnb e Booking. Adicione seus fornecedores com a porcentagem deles (total = 100%).',
    'help.planning.title': '2. Planejamento',
    'help.planning.text': 'Clique em GERAR para baixar os calendarios e atribuir as limpezas automaticamente.',
    'help.results.title': '3. Resultados',
    'help.results.text': 'Altere os fornecedores, filtre, marque "Transmitido" para as datas enviadas.',
    'help.features': 'Funcionalidades',
    'help.feature.persist': 'modificacoes salvas automaticamente.',
    'help.feature.whatsapp': 'envie o planejamento para cada fornecedor.',
    'help.feature.calendar': 'visao mensal com limpezas e reservas.',
    'help.feature.stats': 'graficos de distribuicao por fornecedor.',
    'help.feature.history': 'as limpezas passadas sao arquivadas.',
    'help.feature.notif': 'alertas 2 dias antes da chegada/saida.',
    'help.feature.link': 'compartilhe um link somente leitura.',

    // Nav (missing)
    'nav.config': 'Config',
    'nav.generate': 'Gerar',
    'nav.results': 'Planejamento',
    'nav.stats': 'Estatisticas',
    'nav.more': 'Mais',

    // Properties (missing)
    'property.name_prompt': 'Nome da propriedade:',
    'property.remove_confirm': 'Excluir',

    // Premium (missing)
    'premium.free.property': '1 propriedade',
    'premium.free.providers': '2 fornecedores no maximo',
    'premium.free.ical': 'Calendario iCal',
    'premium.free.ads': 'Publicidade',
    'premium.feat.properties': 'Propriedades ilimitadas',
    'premium.feat.providers': 'Fornecedores ilimitados',
    'premium.feat.noads': 'Sem publicidade',
    'premium.feat.priority': 'Suporte prioritario',
    'premium.feat.export': 'Exportacao PDF avancada',
    'premium.stripe.pending': 'O pagamento estara disponivel em breve. Entre em contato para acesso antecipado!',
    'ad.remove': 'Remover a publicidade',

    // Validation (missing)
    'validation.name.required': 'Por favor, insira um nome.',
    'config.ical.required': 'Insira pelo menos uma URL iCal.',
    'config.provider.required': 'Adicione pelo menos um fornecedor.',
    'config.percentages.invalid': 'O total das porcentagens deve ser 100%',
    'config.saved': 'Configuracao salva',

    // Generate (missing)
    'generate.remaining': 'restam {n} geracao(oes) gratuita(s)',

    // Export (missing)
    'export.empty': 'Nenhum planejamento para exportar.',
    'export.filter.empty': 'Nenhuma limpeza com este filtro.',
    'export.csv.success': 'CSV exportado: {n} limpeza(s)',
    'export.pdf.success': 'PDF exportado: {n} limpeza(s)',
    'export.pdf.title': 'Planejamento de limpezas',
    'export.pdf.generated': 'Gerado em',
    'export.text.copied': 'Planejamento copiado',

    // WhatsApp (missing)
    'whatsapp.empty': 'Nenhuma limpeza para',
    'whatsapp.opened': 'Copiado + WhatsApp aberto para',
    'whatsapp.copied': 'Planejamento copiado para a area de transferencia!',
    'whatsapp.empty.all': 'Nenhum planejamento para enviar.',
    'whatsapp.no.providers': 'Nenhum fornecedor com limpezas.',
    'whatsapp.title': 'Enviar por WhatsApp',
    'whatsapp.select': 'Clique em um fornecedor:',

    // Share (missing)
    'share.save.first': 'Salve a configuracao primeiro.',
    'share.link.copied': 'Link somente leitura copiado!',

    // Provider (missing)
    'provider.added': 'adicionado',
    'provider.delete.confirm': 'Excluir o fornecedor',
    'provider.link.copied': 'Link do fornecedor copiado!',
    'provider.zone.define': 'Definir a zona',

    // Vacation (missing)
    'vacation.none': 'Nenhuma',
    'vacation.title': 'Ferias de',
    'vacation.empty': 'Nenhum periodo de ferias.',
    'share.save_first': 'Salve a configuracao primeiro para gerar o link.',
    'ical.remove_confirm': 'Excluir o calendario',
    'btn.delete': 'Excluir',
    'provider.remove_confirm': 'Excluir o fornecedor',
    'validate.pct': 'O total das porcentagens deve ser 100%',
    'notif.blocked': 'Notificacoes bloqueadas. Autorize-as nas configuracoes do navegador.',
    'notif.denied': 'Permissao de notificacao recusada.',
    'error': 'Erro',

    // Account (missing)
    'account.title': 'Minha conta',
    'account.new_password': 'Nova senha (6 caracteres minimo):',
    'account.pwd_short': 'A senha deve ter pelo menos 6 caracteres.',
    'account.pwd_changed': 'Senha alterada!',
    'account.new_email': 'Novo email:',
    'account.email_sent': 'Email de confirmacao enviado.',
    'account.delete_confirm': 'Tem certeza de que deseja excluir sua conta? Esta acao e irreversivel. Todos os seus dados serao perdidos.',
    'account.delete_btn': 'Excluir definitivamente',
    'account.delete_confirm2': 'Ultima chance! Confirme a exclusao.',
    'account.deleted': 'Conta excluida.',
    'premium.upgrade': 'Passar para Premium',

    // Dashboard (missing)
    'dash.today': 'Limpezas de hoje',
    'dash.week': 'Esta semana',
    'dash.properties': 'Propriedades',
    'dash.providers': 'Fornecedores',
    'dash.no_today': 'Nenhuma limpeza hoje',

    'vacation.dates.required': 'Selecione ambas as datas.',
    'vacation.dates.invalid': 'A data de inicio deve ser anterior a data de fim.',

    // Linen (missing)
    'linen.name.required': 'Insira um nome para o jogo de roupa.',
    'linen.duplicate': 'Este jogo ja existe.',
    'linen.empty': 'Nenhum jogo de roupa. Adicione um acima.',
    'linen.status.available': 'Disponivel',
    'linen.status.used': 'Em uso',
    'linen.status.pressing': 'Na lavanderia',
    'linen.action.mark.used': 'Marcar como usado',
    'linen.action.send.pressing': 'Enviar para lavanderia',
    'linen.action.return': 'Retorno da lavanderia',
    'linen.last.used': 'Ultimo uso:',
    'linen.never.used': 'Nunca usado',
    'linen.history.recent': 'Historico recente',

    // iCal (missing)
    'ical.empty': 'Nenhum calendario configurado',
    'ical.all.added': 'Todas as plataformas ja foram adicionadas',
    'ical.choose.platform': 'Escolher uma plataforma:',
    'ical.add.title': 'Adicionar um calendario',
    'ical.add.button': '+ Adicionar um calendario',
    'ical.delete.confirm': 'Excluir o calendario',

    // Property (missing)
    'property.click.configure': 'Clique em ✏️ para configurar a propriedade',
    'property.type.apartment': 'Apartamento',
    'property.type.house': 'Casa',
    'property.type.studio': 'Estudio',
    'property.type.villa': 'Villa',
    'property.type.chalet': 'Chale',
    'property.type.other': 'Outro',
    'property.image.toolarge': 'Imagem muito grande (max 500 Ko)',
    'property.checklist.empty': 'Nenhuma instrucao',
    'property.name.placeholder': 'Nome do alojamento',
    'property.instruction.placeholder': 'Nova instrucao...',

    // Time (missing)
    'time.today': 'hoje',
    'time.tomorrow': 'amanha',
    'time.in2days': 'em 2 dias',

    // Notifications (missing)
    'notification.unsupported': 'Notificacoes nao suportadas por este navegador.',
    'notification.blocked': 'Notificacoes bloqueadas. Autorize-as nas configuracoes.',
    'notification.denied': 'Permissao de notificacao recusada.',
    'reminder.duplicate': 'Lembrete ja programado para',
    'reminder.scheduled': 'Lembrete programado J-2 para',

    // Premium limits (missing)
    'premium.limit.providers': 'Voce atingiu o limite de {n} fornecedores.',
    'premium.limit.properties': 'Voce atingiu o limite de {n} propriedade(s).',
    'premium.limit.icals': 'Voce atingiu o limite de {n} calendarios.',
    'premium.limit.generations': 'Limite de {n} geracoes/dia atingido.',
    'premium.stats.locked': 'Os graficos e custos sao reservados para usuarios Premium',
    'premium.comm.locked': 'WhatsApp, PDF e Compartilhamento sao reservados para usuarios Premium',
    'premium.history.locked': 'O historico e a lavanderia sao reservados para usuarios Premium',
    'premium.upgrade.text': 'Passe para Premium para desbloquear.',

    // Confirm (missing)
    'confirm.title': 'Confirmar',
    'confirm.cancel': 'Cancelar',
    'confirm.delete': 'Excluir',

    // Changelog (missing)
    'changelog.title': 'Historico de modificacoes',
    'changelog.empty': 'Nenhuma modificacao registrada.',
    'changelog.cleared': 'Historico apagado',

    // Calendar (missing)
    'calendar.legend.cleaning': 'Limpeza',
    'calendar.legend.reservation': 'Reserva',

    // Help tooltips (missing)
    'help.property': 'Configure sua propriedade: nome, endereco, calendarios iCal. Clique em ✏️ para os detalhes e 📍 para a posicao.',
    'help.providers': 'Adicione seus fornecedores com o % de distribuicao (total = 100%). Clique em 📍 para definir a zona de atuacao.',
    'help.planning': 'O planejamento e gerado automaticamente. Clique em Atualizar para forcar a atualizacao. Filtre por fornecedor.',
    'help.communication': 'Exporte em CSV ou envie por WhatsApp. Compartilhe um link somente leitura.',
    'help.history': 'As limpezas passadas sao arquivadas automaticamente. Gerencie seus jogos de roupa em Lavanderia.',

    // Table headers provider list (missing)
    'table.name': 'Nome',
    'table.phone': 'Tel',
    'table.pct': '%',
    'table.rate': 'Tarifa',
    'table.vacations': 'Ferias',
    'table.link': 'Link',

    // Results (missing)
    'results.empty.future': 'Nenhuma limpeza por vir.',
    'results.loading': 'Carregando...',

    // Onboarding (missing)
    'onboarding.welcome': 'Bem-vindo ao Lokizio!',
    'onboarding.role_question': 'Qual e o seu perfil?',
    'onboarding.steps': 'Para comecar:',
    'onboarding.step1': 'Insira o nome e cole as URLs iCal das suas plataformas (Airbnb, Booking...)',
    'onboarding.step2': 'Adicione seus fornecedores com o % de distribuicao',
    'onboarding.step3': 'Gera automaticamente!',
    'onboarding.help': 'Clique em ? ao lado de cada secao para mais ajuda.',
    'onboarding.go': 'Vamos la!',
    'onboarding.concierge.title': 'Modo Concierge',
    'onboarding.owner.title': 'Modo Proprietario',
    'onboarding.provider.title': 'Modo Fornecedor',
    'onboarding.provider.desc': 'Seu gestor ou proprietario o convidou.',
    'onboarding.provider.features': 'O que voce pode fazer:',

    // Roles (missing)
    'role.concierge.title': 'Eu gerencio um servico de concierge',
    'role.concierge.desc': 'Voce gerencia as limpezas para varios proprietarios. Dashboard, faturamento, gestao de equipe.',
    'role.owner.title': 'Eu sou proprietario',
    'role.owner.desc': 'Voce e proprietario e acompanha as limpezas dos seus imoveis.',
    'role.owner.plan': 'Gratis (1 propriedade) / Pro (3.99€/mes)',
    'role.provider.title': 'Eu sou fornecedor de limpeza',
    'role.provider.desc': 'Voce faz as limpezas. Consulte seu planejamento, valide suas intervencoes.',
    'role.provider.plan': 'Gratis (convidado por um gestor)',

    // Team (missing)
    'team.email_required': 'Email obrigatorio',
    'team.admin_only': 'Somente administradores podem gerenciar a equipe',
    'team.invite_error': 'Erro ao enviar o convite',
    'team.remove_confirm': 'Remover este membro da equipe?',

    // KPI (missing)
    'kpi.properties': 'Propriedades',
    'kpi.upcoming': 'Prestacoes por vir',
    'kpi.this_week': 'Esta semana',
    'kpi.providers': 'Fornecedores',
    'kpi.cost': 'Custo previsional',
    'kpi.upcoming_provider': 'Por vir',
    'kpi.done': 'Concluidos',
    'kpi.remaining': 'Restantes',

    // Prop detail (missing)
    'prop.detail.saved': 'Propriedade salva',
  },

  // ═══ ITALIANO ═══
  it: {
    'auth.title': 'Lokizio', 'auth.subtitle': 'Gestione pulizie affitti',
    'auth.tab.login': 'Accedi', 'auth.tab.register': 'Crea account',
    'auth.email': 'Email', 'auth.password': 'Password', 'auth.password.placeholder': '6 caratteri minimo',
    'auth.login.btn': 'Accedi', 'auth.register.btn': 'Crea il mio account',
    'auth.fill.all': 'Compila tutti i campi', 'auth.pass.short': 'La password deve avere almeno 6 caratteri',
    'auth.pass.mismatch': 'Le password non corrispondono', 'auth.logout.confirm': 'Disconnettersi?',
    'header.subtitle': 'Gestione pulizie', 'section.property': 'Proprieta', 'section.team': 'Team pulizie',
    'section.history': 'Storico e Lavanderia', 'config.ical': 'Calendari iCal',
    'config.providers': 'Fornitori', 'config.name': 'Nome', 'config.phone': 'Telefono', 'config.price': 'Tariffa',
    'config.add': '+ Aggiungi', 'provider.add.title': 'Aggiungi fornitore',
    'generate.btn': 'GENERA PIANIFICAZIONE', 'generate.refresh': 'Aggiorna',
    'generate.loading': 'Generazione...', 'generate.success': 'Pianificazione generata con successo',
    'results.title': 'Pianificazione', 'results.tab.list': 'Lista', 'results.tab.calendar': 'Calendario', 'results.tab.stats': 'Statistiche',
    'results.tab.history': 'Storico', 'results.tab.pressing': 'Lavanderia',
    'results.csv': 'CSV', 'results.pdf': 'PDF', 'results.copy': 'Copia',
    'comm.title': 'Comunicazione ed Esportazione', 'comm.share': 'Condividi',
    'send.btn': 'Invia', 'send.title': 'Invia pianificazione', 'send.copy': 'Copia testo',
    'premium.title': 'Passa a Premium', 'premium.subtitle': 'Fornitori illimitati, senza pubblicita',
    'premium.btn': 'Vedi offerte', 'premium.modal.title': 'Scegli il tuo piano',
    'premium.plan.free': 'Gratuito', 'premium.plan.current': 'Piano attuale', 'premium.btn.upgrade': 'Passa a Premium',
    'premium.cancel': 'Annullabile in qualsiasi momento. Pagamento sicuro tramite Stripe.',
    'table.source': 'Fonte', 'table.checkin': 'Arrivo', 'table.checkout': 'Partenza',
    'table.interval': 'Intervallo', 'table.cleaning': 'Pulizia il', 'table.provider': 'Fornitore',
    'property.label': 'Proprieta:', 'property.add': '+ Aggiungi',
    'prop.detail.title': 'Dettagli proprieta', 'prop.detail.name': 'Nome', 'prop.detail.address': 'Indirizzo',
    'prop.detail.type': 'Tipo', 'prop.detail.rooms': 'Stanze', 'prop.detail.price': 'Tariffa pulizia (€)',
    'prop.detail.duration': 'Durata stimata', 'prop.detail.checklist': 'Istruzioni pulizia',
    'prop.detail.notes': 'Note', 'prop.detail.save': 'Salva',
    'map.radius': 'Raggio:', 'map.save': 'Salva', 'map.not_found': 'Indirizzo non trovato',
    'modal.close': 'Chiudi', 'modal.ok': 'OK',
    'status.ready': 'Pronto', 'status.restored': 'Pianificazione ripristinata',
    'ad.label': 'Pubblicita', 'calendar.today': 'Oggi',
    'install.title': 'Installa Lokizio', 'install.btn': 'Installa',
    'install.subtitle': 'Accesso rapido dalla schermata iniziale',

    // Auth (missing)
    'auth.confirm': 'Conferma la password',
    'auth.confirm.placeholder': 'Ridigita la password',
    'auth.register.loading': 'Creazione in corso...',
    'auth.pass.min': 'La password deve avere almeno 6 caratteri',
    'auth.email.taken': 'Questa email e gia in uso',
    'auth.login.invalid': 'Email o password non corretti',
    'auth.register.success': 'Account creato!',
    'auth.register.check_email': 'Un\'email di conferma e stata inviata a <b>{email}</b>.<br>Clicca sul link nell\'email e poi torna per accedere.',
    'auth.register.connecting': 'Account creato! Connessione...',
    'auth.remember': 'Ricordami',
    'auth.forgot': 'Password dimenticata?',
    'auth.reset.sent': 'Email di reimpostazione inviata! Controlla la tua casella di posta.',

    // Header (missing)
    'header.share': 'Condividi in sola lettura',
    'header.changelog': 'Storico delle modifiche',
    'header.theme': 'Tema chiaro/scuro',
    'header.help': 'Aiuto',
    'header.logout': 'Disconnessione',

    // Config (missing)
    'config.title': 'Configurazione',
    'config.ical.airbnb': 'URL iCal Airbnb...',
    'config.ical.booking': 'URL iCal Booking...',
    'config.paste': 'Incolla',
    'config.pct': '%',

    // Generate (missing)
    'generate.title': 'Genera',
    'generate.save': 'Salva configurazione',

    // Map (missing)
    'map.provider_zone': 'Zona di',
    'map.property_location': 'Posizione di',
    'map.saved': 'Posizione salvata per',
    'map.search': 'Cerca un indirizzo...',

    // Comm (missing)
    'comm.provlinks': 'Link fornitori',
    'comm.export': 'Esporta',

    // Results (missing)
    'results.empty': 'Clicca su GENERA PIANIFICAZIONE per visualizzare le pulizie',
    'results.whatsapp': 'WhatsApp',
    'results.clear_history': 'Cancella lo storico',

    // Stats (missing)
    'stats.empty': 'Genera una pianificazione per vedere le statistiche.',

    // Modals (missing)
    'modal.vacations': 'Vacanze del fornitore',

    // Help (missing)
    'help.title': 'Aiuto',
    'help.config.title': '1. Configurazione',
    'help.config.text': 'Incolla le URL iCal di Airbnb e Booking. Aggiungi i tuoi fornitori con la loro percentuale (totale = 100%).',
    'help.planning.title': '2. Pianificazione',
    'help.planning.text': 'Clicca GENERA per scaricare i calendari e assegnare le pulizie automaticamente.',
    'help.results.title': '3. Risultati',
    'help.results.text': 'Cambia i fornitori, filtra, spunta "Trasmesso" per le date inviate.',
    'help.features': 'Funzionalita',
    'help.feature.persist': 'modifiche salvate automaticamente.',
    'help.feature.whatsapp': 'invia la pianificazione a ogni fornitore.',
    'help.feature.calendar': 'vista mensile con pulizie e prenotazioni.',
    'help.feature.stats': 'grafici di distribuzione per fornitore.',
    'help.feature.history': 'le pulizie passate vengono archiviate.',
    'help.feature.notif': 'avvisi 2 giorni prima dell\'arrivo/partenza.',
    'help.feature.link': 'condividi un link in sola lettura.',

    // Nav (missing)
    'nav.config': 'Config',
    'nav.generate': 'Genera',
    'nav.results': 'Pianificazione',
    'nav.stats': 'Statistiche',
    'nav.more': 'Altro',

    // Properties (missing)
    'property.name_prompt': 'Nome della proprieta:',
    'property.remove_confirm': 'Elimina',

    // Premium (missing)
    'premium.free.property': '1 proprieta',
    'premium.free.providers': '2 fornitori massimo',
    'premium.free.ical': 'Calendario iCal',
    'premium.free.ads': 'Pubblicita',
    'premium.feat.properties': 'Proprieta illimitate',
    'premium.feat.providers': 'Fornitori illimitati',
    'premium.feat.noads': 'Nessuna pubblicita',
    'premium.feat.priority': 'Supporto prioritario',
    'premium.feat.export': 'Esportazione PDF avanzata',
    'premium.stripe.pending': 'Il pagamento sara presto disponibile. Contattaci per un accesso anticipato!',
    'ad.remove': 'Rimuovere la pubblicita',

    // Validation (missing)
    'validation.name.required': 'Inserisci un nome.',
    'config.ical.required': 'Inserisci almeno un URL iCal.',
    'config.provider.required': 'Aggiungi almeno un fornitore.',
    'config.percentages.invalid': 'Il totale delle percentuali deve essere 100%',
    'config.saved': 'Configurazione salvata',

    // Generate (missing)
    'generate.remaining': 'restano {n} generazione(i) gratuita(e)',

    // Export (missing)
    'export.empty': 'Nessuna pianificazione da esportare.',
    'export.filter.empty': 'Nessuna pulizia con questo filtro.',
    'export.csv.success': 'CSV esportato: {n} pulizia(e)',
    'export.pdf.success': 'PDF esportato: {n} pulizia(e)',
    'export.pdf.title': 'Pianificazione pulizie',
    'export.pdf.generated': 'Generato il',
    'export.text.copied': 'Pianificazione copiata',

    // WhatsApp (missing)
    'whatsapp.empty': 'Nessuna pulizia per',
    'whatsapp.opened': 'Copiato + WhatsApp aperto per',
    'whatsapp.copied': 'Pianificazione copiata negli appunti!',
    'whatsapp.empty.all': 'Nessuna pianificazione da inviare.',
    'whatsapp.no.providers': 'Nessun fornitore con pulizie.',
    'whatsapp.title': 'Invia tramite WhatsApp',
    'whatsapp.select': 'Clicca su un fornitore:',

    // Share (missing)
    'share.save.first': 'Salva prima la configurazione.',
    'share.link.copied': 'Link in sola lettura copiato!',

    // Provider (missing)
    'provider.added': 'aggiunto',
    'provider.delete.confirm': 'Elimina il fornitore',
    'provider.link.copied': 'Link del fornitore copiato!',
    'provider.zone.define': 'Definisci la zona',

    // Vacation (missing)
    'vacation.none': 'Nessuna',
    'vacation.title': 'Vacanze di',
    'vacation.empty': 'Nessun periodo di vacanza.',
    'share.save_first': 'Salva prima la configurazione per generare il link.',
    'ical.remove_confirm': 'Elimina il calendario',
    'btn.delete': 'Elimina',
    'provider.remove_confirm': 'Elimina il fornitore',
    'validate.pct': 'Il totale delle percentuali deve essere 100%',
    'notif.blocked': 'Notifiche bloccate. Autorizzale nelle impostazioni del browser.',
    'notif.denied': 'Permesso di notifica rifiutato.',
    'error': 'Errore',

    // Account (missing)
    'account.title': 'Il mio account',
    'account.new_password': 'Nuova password (6 caratteri minimo):',
    'account.pwd_short': 'La password deve avere almeno 6 caratteri.',
    'account.pwd_changed': 'Password modificata!',
    'account.new_email': 'Nuova email:',
    'account.email_sent': 'Email di conferma inviata.',
    'account.delete_confirm': 'Sei sicuro di voler eliminare il tuo account? Questa azione e irreversibile. Tutti i tuoi dati andranno persi.',
    'account.delete_btn': 'Elimina definitivamente',
    'account.delete_confirm2': 'Ultima possibilita! Conferma l\'eliminazione.',
    'account.deleted': 'Account eliminato.',
    'premium.upgrade': 'Passa a Premium',

    // Dashboard (missing)
    'dash.today': 'Pulizie di oggi',
    'dash.week': 'Questa settimana',
    'dash.properties': 'Proprieta',
    'dash.providers': 'Fornitori',
    'dash.no_today': 'Nessuna pulizia oggi',

    'vacation.dates.required': 'Seleziona entrambe le date.',
    'vacation.dates.invalid': 'La data di inizio deve essere anteriore alla fine.',

    // Linen (missing)
    'linen.name.required': 'Inserisci un nome per il set di biancheria.',
    'linen.duplicate': 'Questo set esiste gia.',
    'linen.empty': 'Nessun set di biancheria. Aggiungine uno sopra.',
    'linen.status.available': 'Disponibile',
    'linen.status.used': 'In uso',
    'linen.status.pressing': 'In lavanderia',
    'linen.action.mark.used': 'Segna come usato',
    'linen.action.send.pressing': 'Invia in lavanderia',
    'linen.action.return': 'Ritorno dalla lavanderia',
    'linen.last.used': 'Ultimo utilizzo:',
    'linen.never.used': 'Mai utilizzato',
    'linen.history.recent': 'Storico recente',

    // iCal (missing)
    'ical.empty': 'Nessun calendario configurato',
    'ical.all.added': 'Tutte le piattaforme sono gia aggiunte',
    'ical.choose.platform': 'Scegli una piattaforma:',
    'ical.add.title': 'Aggiungi un calendario',
    'ical.add.button': '+ Aggiungi un calendario',
    'ical.delete.confirm': 'Elimina il calendario',

    // Property (missing)
    'property.click.configure': 'Clicca ✏️ per configurare la proprieta',
    'property.type.apartment': 'Appartamento',
    'property.type.house': 'Casa',
    'property.type.studio': 'Monolocale',
    'property.type.villa': 'Villa',
    'property.type.chalet': 'Chalet',
    'property.type.other': 'Altro',
    'property.image.toolarge': 'Immagine troppo grande (max 500 Ko)',
    'property.checklist.empty': 'Nessuna istruzione',
    'property.name.placeholder': 'Nome dell\'alloggio',
    'property.instruction.placeholder': 'Nuova istruzione...',

    // Time (missing)
    'time.today': 'oggi',
    'time.tomorrow': 'domani',
    'time.in2days': 'tra 2 giorni',

    // Notifications (missing)
    'notification.unsupported': 'Notifiche non supportate da questo browser.',
    'notification.blocked': 'Notifiche bloccate. Autorizzale nelle impostazioni.',
    'notification.denied': 'Permesso di notifica rifiutato.',
    'reminder.duplicate': 'Promemoria gia programmato per',
    'reminder.scheduled': 'Promemoria programmato G-2 per',

    // Premium limits (missing)
    'premium.limit.providers': 'Hai raggiunto il limite di {n} fornitori.',
    'premium.limit.properties': 'Hai raggiunto il limite di {n} proprieta.',
    'premium.limit.icals': 'Hai raggiunto il limite di {n} calendari.',
    'premium.limit.generations': 'Limite di {n} generazioni/giorno raggiunto.',
    'premium.stats.locked': 'I grafici e i costi sono riservati agli utenti Premium',
    'premium.comm.locked': 'WhatsApp, PDF e Condivisione sono riservati agli utenti Premium',
    'premium.history.locked': 'Lo storico e la lavanderia sono riservati agli utenti Premium',
    'premium.upgrade.text': 'Passa a Premium per sbloccare.',

    // Confirm (missing)
    'confirm.title': 'Conferma',
    'confirm.cancel': 'Annulla',
    'confirm.delete': 'Elimina',

    // Changelog (missing)
    'changelog.title': 'Storico delle modifiche',
    'changelog.empty': 'Nessuna modifica registrata.',
    'changelog.cleared': 'Storico cancellato',

    // Calendar (missing)
    'calendar.legend.cleaning': 'Pulizia',
    'calendar.legend.reservation': 'Prenotazione',

    // Send modal (missing)
    // (send.btn, send.title, send.copy already present)

    // Help tooltips (missing)
    'help.property': 'Configura il tuo alloggio: nome, indirizzo, calendari iCal. Clicca ✏️ per i dettagli e 📍 per la posizione.',
    'help.providers': 'Aggiungi i tuoi fornitori con la % di distribuzione (totale = 100%). Clicca 📍 per definire la loro zona d\'azione.',
    'help.planning': 'La pianificazione viene generata automaticamente. Clicca Aggiorna per forzare l\'aggiornamento. Filtra per fornitore.',
    'help.communication': 'Esporta in CSV o invia tramite WhatsApp. Condividi un link in sola lettura.',
    'help.history': 'Le pulizie passate vengono archiviate automaticamente. Gestisci i tuoi set di biancheria in Lavanderia.',

    // Table headers provider list (missing)
    'table.name': 'Nome',
    'table.phone': 'Tel',
    'table.pct': '%',
    'table.rate': 'Tariffa',
    'table.vacations': 'Vacanze',
    'table.link': 'Link',

    // Results (missing)
    'results.empty.future': 'Nessuna pulizia in arrivo.',
    'results.loading': 'Caricamento...',

    // Onboarding (missing)
    'onboarding.welcome': 'Benvenuto su Lokizio!',
    'onboarding.role_question': 'Qual e il tuo profilo?',
    'onboarding.steps': 'Per iniziare:',
    'onboarding.step1': 'Inserisci il nome e incolla gli URL iCal delle tue piattaforme (Airbnb, Booking...)',
    'onboarding.step2': 'Aggiungi i tuoi fornitori con la % di distribuzione',
    'onboarding.step3': 'Si genera automaticamente!',
    'onboarding.help': 'Clicca ? accanto a ogni sezione per ulteriore aiuto.',
    'onboarding.go': 'Andiamo!',
    'onboarding.concierge.title': 'Modalita Concierge',
    'onboarding.owner.title': 'Modalita Proprietario',
    'onboarding.provider.title': 'Modalita Fornitore',
    'onboarding.provider.desc': 'Il tuo gestore o proprietario ti ha invitato.',
    'onboarding.provider.features': 'Cosa puoi fare:',

    // Roles (missing)
    'role.concierge.title': 'Gestisco un servizio di concierge',
    'role.concierge.desc': 'Gestisci le pulizie per diversi proprietari. Dashboard, fatturazione, gestione del team.',
    'role.owner.title': 'Sono proprietario',
    'role.owner.desc': 'Sei proprietario e segui le pulizie dei tuoi immobili.',
    'role.owner.plan': 'Gratuito (1 proprieta) / Pro (3.99€/mese)',
    'role.provider.title': 'Sono fornitore di pulizie',
    'role.provider.desc': 'Fai le pulizie. Consulta la tua pianificazione, convalida i tuoi interventi.',
    'role.provider.plan': 'Gratuito (invitato da un gestore)',

    // Team (missing)
    'team.email_required': 'Email obbligatoria',
    'team.admin_only': 'Solo gli amministratori possono gestire il team',
    'team.invite_error': 'Errore durante l\'invio dell\'invito',
    'team.remove_confirm': 'Rimuovere questo membro dal team?',

    // KPI (missing)
    'kpi.properties': 'Proprieta',
    'kpi.upcoming': 'Prestazioni in arrivo',
    'kpi.this_week': 'Questa settimana',
    'kpi.providers': 'Fornitori',
    'kpi.cost': 'Costo previsionale',
    'kpi.upcoming_provider': 'In arrivo',
    'kpi.done': 'Completati',
    'kpi.remaining': 'Rimanenti',

    // Prop detail (missing)
    'prop.detail.saved': 'Proprieta salvata',
  },

  // ═══ DEUTSCH ═══
  de: {
    'auth.title': 'Lokizio', 'auth.subtitle': 'Reinigungsverwaltung fur Ferienwohnungen',
    'auth.tab.login': 'Anmelden', 'auth.tab.register': 'Konto erstellen',
    'auth.email': 'Email', 'auth.password': 'Passwort', 'auth.password.placeholder': 'Mindestens 6 Zeichen',
    'auth.login.btn': 'Anmelden', 'auth.register.btn': 'Konto erstellen',
    'auth.fill.all': 'Alle Felder ausfuellen', 'auth.pass.short': 'Passwort muss mindestens 6 Zeichen haben',
    'auth.pass.mismatch': 'Passwoerter stimmen nicht ueberein', 'auth.logout.confirm': 'Abmelden?',
    'header.subtitle': 'Reinigungsverwaltung', 'section.property': 'Unterkunft', 'section.team': 'Reinigungsteam',
    'section.history': 'Verlauf und Waescherei', 'config.ical': 'iCal-Kalender',
    'config.providers': 'Dienstleister', 'config.name': 'Name', 'config.phone': 'Telefon', 'config.price': 'Preis',
    'config.add': '+ Hinzufuegen', 'provider.add.title': 'Dienstleister hinzufuegen',
    'generate.btn': 'PLANUNG ERSTELLEN', 'generate.refresh': 'Aktualisieren',
    'generate.loading': 'Wird erstellt...', 'generate.success': 'Planung erfolgreich erstellt',
    'results.title': 'Planung', 'results.tab.list': 'Liste', 'results.tab.calendar': 'Kalender', 'results.tab.stats': 'Statistiken',
    'results.tab.history': 'Verlauf', 'results.tab.pressing': 'Waescherei',
    'results.csv': 'CSV', 'results.pdf': 'PDF', 'results.copy': 'Kopieren',
    'comm.title': 'Kommunikation & Export', 'comm.share': 'Teilen',
    'send.btn': 'Senden', 'send.title': 'Planung senden', 'send.copy': 'Text kopieren',
    'premium.title': 'Auf Premium upgraden', 'premium.subtitle': 'Unbegrenzte Dienstleister, keine Werbung',
    'premium.btn': 'Angebote', 'premium.modal.title': 'Waehlen Sie Ihren Plan',
    'premium.plan.free': 'Kostenlos', 'premium.plan.current': 'Aktueller Plan', 'premium.btn.upgrade': 'Auf Premium upgraden',
    'premium.cancel': 'Jederzeit kuendbar. Sichere Zahlung ueber Stripe.',
    'table.source': 'Quelle', 'table.checkin': 'Anreise', 'table.checkout': 'Abreise',
    'table.interval': 'Intervall', 'table.cleaning': 'Reinigung am', 'table.provider': 'Dienstleister',
    'property.label': 'Unterkunft:', 'property.add': '+ Hinzufuegen',
    'prop.detail.title': 'Unterkunft-Details', 'prop.detail.name': 'Name', 'prop.detail.address': 'Adresse',
    'prop.detail.type': 'Typ', 'prop.detail.rooms': 'Zimmer', 'prop.detail.price': 'Reinigungspreis (€)',
    'prop.detail.duration': 'Geschaetzte Dauer', 'prop.detail.checklist': 'Reinigungsanleitung',
    'prop.detail.notes': 'Notizen', 'prop.detail.save': 'Speichern',
    'map.radius': 'Radius:', 'map.save': 'Speichern', 'map.not_found': 'Adresse nicht gefunden',
    'modal.close': 'Schliessen', 'modal.ok': 'OK',
    'status.ready': 'Bereit', 'status.restored': 'Planung wiederhergestellt',
    'ad.label': 'Werbung', 'calendar.today': 'Heute',
    'install.title': 'Lokizio installieren', 'install.btn': 'Installieren',
    'install.subtitle': 'Schnellzugriff vom Startbildschirm',

    // Auth (missing)
    'auth.confirm': 'Passwort bestaetigen',
    'auth.confirm.placeholder': 'Passwort erneut eingeben',
    'auth.register.loading': 'Erstellung laeuft...',
    'auth.pass.min': 'Passwort muss mindestens 6 Zeichen haben',
    'auth.email.taken': 'Diese Email wird bereits verwendet',
    'auth.login.invalid': 'Email oder Passwort falsch',
    'auth.register.success': 'Konto erstellt!',
    'auth.register.check_email': 'Eine Bestaetigungsemail wurde an <b>{email}</b> gesendet.<br>Klicken Sie auf den Link in der Email und kommen Sie zurueck zum Anmelden.',
    'auth.register.connecting': 'Konto erstellt! Verbindung...',
    'auth.remember': 'Angemeldet bleiben',
    'auth.forgot': 'Passwort vergessen?',
    'auth.reset.sent': 'Zuruecksetzungsemail gesendet! Pruefen Sie Ihren Posteingang.',

    // Header (missing)
    'header.share': 'Nur-Lesen-Link teilen',
    'header.changelog': 'Aenderungsverlauf',
    'header.theme': 'Helles/dunkles Design',
    'header.help': 'Hilfe',
    'header.logout': 'Abmelden',

    // Config (missing)
    'config.title': 'Konfiguration',
    'config.ical.airbnb': 'iCal-URL Airbnb...',
    'config.ical.booking': 'iCal-URL Booking...',
    'config.paste': 'Einfuegen',
    'config.pct': '%',

    // Generate (missing)
    'generate.title': 'Generieren',
    'generate.save': 'Konfiguration speichern',

    // Map (missing)
    'map.provider_zone': 'Zone von',
    'map.property_location': 'Position von',
    'map.saved': 'Position gespeichert fuer',
    'map.search': 'Adresse suchen...',

    // Comm (missing)
    'comm.provlinks': 'Dienstleister-Links',
    'comm.export': 'Exportieren',

    // Results (missing)
    'results.empty': 'Klicken Sie auf PLANUNG ERSTELLEN um die Reinigungen anzuzeigen',
    'results.whatsapp': 'WhatsApp',
    'results.clear_history': 'Verlauf loeschen',

    // Stats (missing)
    'stats.empty': 'Erstellen Sie eine Planung um die Statistiken zu sehen.',

    // Modals (missing)
    'modal.vacations': 'Urlaub des Dienstleisters',

    // Help (missing)
    'help.title': 'Hilfe',
    'help.config.title': '1. Konfiguration',
    'help.config.text': 'Fuegen Sie die iCal-URLs von Airbnb und Booking ein. Fuegen Sie Ihre Dienstleister mit ihrem Prozentsatz hinzu (Gesamt = 100%).',
    'help.planning.title': '2. Planung',
    'help.planning.text': 'Klicken Sie auf ERSTELLEN um die Kalender herunterzuladen und die Reinigungen automatisch zuzuweisen.',
    'help.results.title': '3. Ergebnisse',
    'help.results.text': 'Aendern Sie die Dienstleister, filtern Sie, markieren Sie "Uebermittelt" fuer gesendete Termine.',
    'help.features': 'Funktionen',
    'help.feature.persist': 'Aenderungen werden automatisch gespeichert.',
    'help.feature.whatsapp': 'senden Sie die Planung an jeden Dienstleister.',
    'help.feature.calendar': 'Monatsansicht mit Reinigungen und Buchungen.',
    'help.feature.stats': 'Verteilungsdiagramme pro Dienstleister.',
    'help.feature.history': 'vergangene Reinigungen werden archiviert.',
    'help.feature.notif': 'Benachrichtigungen 2 Tage vor An-/Abreise.',
    'help.feature.link': 'teilen Sie einen Nur-Lesen-Link.',

    // Nav (missing)
    'nav.config': 'Config',
    'nav.generate': 'Erstellen',
    'nav.results': 'Planung',
    'nav.stats': 'Statistiken',
    'nav.more': 'Mehr',

    // Properties (missing)
    'property.name_prompt': 'Name der Unterkunft:',
    'property.remove_confirm': 'Loeschen',

    // Premium (missing)
    'premium.free.property': '1 Unterkunft',
    'premium.free.providers': '2 Dienstleister maximal',
    'premium.free.ical': 'iCal-Kalender',
    'premium.free.ads': 'Werbung',
    'premium.feat.properties': 'Unbegrenzte Unterkuenfte',
    'premium.feat.providers': 'Unbegrenzte Dienstleister',
    'premium.feat.noads': 'Keine Werbung',
    'premium.feat.priority': 'Prioritaetssupport',
    'premium.feat.export': 'Erweiterter PDF-Export',
    'premium.stripe.pending': 'Die Zahlung wird bald verfuegbar sein. Kontaktieren Sie uns fuer fruehen Zugang!',
    'ad.remove': 'Werbung entfernen',

    // Validation (missing)
    'validation.name.required': 'Bitte geben Sie einen Namen ein.',
    'config.ical.required': 'Geben Sie mindestens eine iCal-URL ein.',
    'config.provider.required': 'Fuegen Sie mindestens einen Dienstleister hinzu.',
    'config.percentages.invalid': 'Die Gesamtprozente muessen 100% ergeben',
    'config.saved': 'Konfiguration gespeichert',

    // Generate (missing)
    'generate.remaining': 'noch {n} kostenlose Generierung(en) uebrig',

    // Export (missing)
    'export.empty': 'Keine Planung zum Exportieren.',
    'export.filter.empty': 'Keine Reinigung mit diesem Filter.',
    'export.csv.success': 'CSV exportiert: {n} Reinigung(en)',
    'export.pdf.success': 'PDF exportiert: {n} Reinigung(en)',
    'export.pdf.title': 'Reinigungsplanung',
    'export.pdf.generated': 'Erstellt am',
    'export.text.copied': 'Planung kopiert',

    // WhatsApp (missing)
    'whatsapp.empty': 'Keine Reinigung fuer',
    'whatsapp.opened': 'Kopiert + WhatsApp geoeffnet fuer',
    'whatsapp.copied': 'Planung in die Zwischenablage kopiert!',
    'whatsapp.empty.all': 'Keine Planung zum Senden.',
    'whatsapp.no.providers': 'Kein Dienstleister mit Reinigungen.',
    'whatsapp.title': 'Per WhatsApp senden',
    'whatsapp.select': 'Klicken Sie auf einen Dienstleister:',

    // Share (missing)
    'share.save.first': 'Speichern Sie zuerst die Konfiguration.',
    'share.link.copied': 'Nur-Lesen-Link kopiert!',

    // Provider (missing)
    'provider.added': 'hinzugefuegt',
    'provider.delete.confirm': 'Dienstleister loeschen',
    'provider.link.copied': 'Dienstleister-Link kopiert!',
    'provider.zone.define': 'Zone definieren',

    // Vacation (missing)
    'vacation.none': 'Keine',
    'vacation.title': 'Urlaub von',
    'vacation.empty': 'Kein Urlaubszeitraum.',
    'share.save_first': 'Speichern Sie zuerst die Konfiguration um den Link zu generieren.',
    'ical.remove_confirm': 'Kalender loeschen',
    'btn.delete': 'Loeschen',
    'provider.remove_confirm': 'Dienstleister loeschen',
    'validate.pct': 'Die Gesamtprozente muessen 100% ergeben',
    'notif.blocked': 'Benachrichtigungen blockiert. Erlauben Sie sie in den Browsereinstellungen.',
    'notif.denied': 'Benachrichtigungsberechtigung verweigert.',
    'error': 'Fehler',

    // Account (missing)
    'account.title': 'Mein Konto',
    'account.new_password': 'Neues Passwort (mindestens 6 Zeichen):',
    'account.pwd_short': 'Das Passwort muss mindestens 6 Zeichen haben.',
    'account.pwd_changed': 'Passwort geaendert!',
    'account.new_email': 'Neue Email:',
    'account.email_sent': 'Bestaetigungsemail gesendet.',
    'account.delete_confirm': 'Sind Sie sicher, dass Sie Ihr Konto loeschen moechten? Diese Aktion ist unwiderruflich. Alle Ihre Daten gehen verloren.',
    'account.delete_btn': 'Endgueltig loeschen',
    'account.delete_confirm2': 'Letzte Chance! Bestaetigen Sie die Loeschung.',
    'account.deleted': 'Konto geloescht.',
    'premium.upgrade': 'Auf Premium upgraden',

    // Dashboard (missing)
    'dash.today': 'Reinigungen heute',
    'dash.week': 'Diese Woche',
    'dash.properties': 'Unterkuenfte',
    'dash.providers': 'Dienstleister',
    'dash.no_today': 'Keine Reinigung heute',

    'vacation.dates.required': 'Waehlen Sie beide Daten aus.',
    'vacation.dates.invalid': 'Das Startdatum muss vor dem Enddatum liegen.',

    // Linen (missing)
    'linen.name.required': 'Geben Sie einen Namen fuer das Waescheset ein.',
    'linen.duplicate': 'Dieses Set existiert bereits.',
    'linen.empty': 'Kein Waescheset. Fuegen Sie oben eines hinzu.',
    'linen.status.available': 'Verfuegbar',
    'linen.status.used': 'In Gebrauch',
    'linen.status.pressing': 'In der Waescherei',
    'linen.action.mark.used': 'Als benutzt markieren',
    'linen.action.send.pressing': 'In die Waescherei senden',
    'linen.action.return': 'Rueckkehr aus der Waescherei',
    'linen.last.used': 'Letzte Verwendung:',
    'linen.never.used': 'Nie benutzt',
    'linen.history.recent': 'Aktueller Verlauf',

    // iCal (missing)
    'ical.empty': 'Kein Kalender konfiguriert',
    'ical.all.added': 'Alle Plattformen sind bereits hinzugefuegt',
    'ical.choose.platform': 'Plattform waehlen:',
    'ical.add.title': 'Kalender hinzufuegen',
    'ical.add.button': '+ Kalender hinzufuegen',
    'ical.delete.confirm': 'Kalender loeschen',

    // Property (missing)
    'property.click.configure': 'Klicken Sie ✏️ um die Unterkunft zu konfigurieren',
    'property.type.apartment': 'Wohnung',
    'property.type.house': 'Haus',
    'property.type.studio': 'Studio',
    'property.type.villa': 'Villa',
    'property.type.chalet': 'Chalet',
    'property.type.other': 'Andere',
    'property.image.toolarge': 'Bild zu gross (max 500 Ko)',
    'property.checklist.empty': 'Keine Anweisungen',
    'property.name.placeholder': 'Name der Unterkunft',
    'property.instruction.placeholder': 'Neue Anweisung...',

    // Time (missing)
    'time.today': 'heute',
    'time.tomorrow': 'morgen',
    'time.in2days': 'in 2 Tagen',

    // Notifications (missing)
    'notification.unsupported': 'Benachrichtigungen werden von diesem Browser nicht unterstuetzt.',
    'notification.blocked': 'Benachrichtigungen blockiert. Erlauben Sie sie in den Einstellungen.',
    'notification.denied': 'Benachrichtigungsberechtigung verweigert.',
    'reminder.duplicate': 'Erinnerung bereits geplant fuer',
    'reminder.scheduled': 'Erinnerung T-2 geplant fuer',

    // Premium limits (missing)
    'premium.limit.providers': 'Sie haben das Limit von {n} Dienstleistern erreicht.',
    'premium.limit.properties': 'Sie haben das Limit von {n} Unterkunft(en) erreicht.',
    'premium.limit.icals': 'Sie haben das Limit von {n} Kalendern erreicht.',
    'premium.limit.generations': 'Limit von {n} Generierungen/Tag erreicht.',
    'premium.stats.locked': 'Diagramme und Kosten sind Premium-Nutzern vorbehalten',
    'premium.comm.locked': 'WhatsApp, PDF und Teilen sind Premium-Nutzern vorbehalten',
    'premium.history.locked': 'Verlauf und Waescherei sind Premium-Nutzern vorbehalten',
    'premium.upgrade.text': 'Upgraden Sie auf Premium zum Freischalten.',

    // Confirm (missing)
    'confirm.title': 'Bestaetigen',
    'confirm.cancel': 'Abbrechen',
    'confirm.delete': 'Loeschen',

    // Changelog (missing)
    'changelog.title': 'Aenderungsverlauf',
    'changelog.empty': 'Keine Aenderungen verzeichnet.',
    'changelog.cleared': 'Verlauf geloescht',

    // Calendar (missing)
    'calendar.legend.cleaning': 'Reinigung',
    'calendar.legend.reservation': 'Buchung',

    // Help tooltips (missing)
    'help.property': 'Konfigurieren Sie Ihre Unterkunft: Name, Adresse, iCal-Kalender. Klicken Sie ✏️ fuer Details und 📍 fuer die Position.',
    'help.providers': 'Fuegen Sie Ihre Dienstleister mit ihrem %-Anteil hinzu (Gesamt = 100%). Klicken Sie 📍 um ihre Einsatzzone zu definieren.',
    'help.planning': 'Die Planung wird automatisch erstellt. Klicken Sie auf Aktualisieren um die Aktualisierung zu erzwingen. Filtern Sie nach Dienstleister.',
    'help.communication': 'Exportieren Sie als CSV oder senden Sie per WhatsApp. Teilen Sie einen Nur-Lesen-Link.',
    'help.history': 'Vergangene Reinigungen werden automatisch archiviert. Verwalten Sie Ihre Waeschesets unter Waescherei.',

    // Table headers provider list (missing)
    'table.name': 'Name',
    'table.phone': 'Tel',
    'table.pct': '%',
    'table.rate': 'Preis',
    'table.vacations': 'Urlaub',
    'table.link': 'Link',

    // Results (missing)
    'results.empty.future': 'Keine anstehenden Reinigungen.',
    'results.loading': 'Wird geladen...',

    // Onboarding (missing)
    'onboarding.welcome': 'Willkommen bei Lokizio!',
    'onboarding.role_question': 'Was ist Ihr Profil?',
    'onboarding.steps': 'Um zu beginnen:',
    'onboarding.step1': 'Geben Sie den Namen ein und fuegen Sie die iCal-URLs Ihrer Plattformen ein (Airbnb, Booking...)',
    'onboarding.step2': 'Fuegen Sie Ihre Dienstleister mit ihrem %-Anteil hinzu',
    'onboarding.step3': 'Es wird automatisch generiert!',
    'onboarding.help': 'Klicken Sie ? neben jedem Abschnitt fuer weitere Hilfe.',
    'onboarding.go': 'Los geht\'s!',
    'onboarding.concierge.title': 'Concierge-Modus',
    'onboarding.owner.title': 'Eigentuemer-Modus',
    'onboarding.provider.title': 'Dienstleister-Modus',
    'onboarding.provider.desc': 'Ihr Verwalter oder Eigentuemer hat Sie eingeladen.',
    'onboarding.provider.features': 'Was Sie tun koennen:',

    // Roles (missing)
    'role.concierge.title': 'Ich verwalte einen Concierge-Service',
    'role.concierge.desc': 'Sie verwalten die Reinigungen fuer mehrere Eigentuemer. Dashboard, Abrechnung, Teamverwaltung.',
    'role.owner.title': 'Ich bin Eigentuemer',
    'role.owner.desc': 'Sie sind Eigentuemer und verfolgen die Reinigungen Ihrer Immobilien.',
    'role.owner.plan': 'Kostenlos (1 Unterkunft) / Pro (3.99€/Monat)',
    'role.provider.title': 'Ich bin Reinigungsdienstleister',
    'role.provider.desc': 'Sie fuehren die Reinigungen durch. Sehen Sie Ihre Planung ein, bestaetigen Sie Ihre Einsaetze.',
    'role.provider.plan': 'Kostenlos (von einem Verwalter eingeladen)',

    // Team (missing)
    'team.email_required': 'Email erforderlich',
    'team.admin_only': 'Nur Administratoren koennen das Team verwalten',
    'team.invite_error': 'Fehler beim Senden der Einladung',
    'team.remove_confirm': 'Dieses Mitglied aus dem Team entfernen?',

    // KPI (missing)
    'kpi.properties': 'Unterkuenfte',
    'kpi.upcoming': 'Anstehende Reinigungen',
    'kpi.this_week': 'Diese Woche',
    'kpi.providers': 'Dienstleister',
    'kpi.cost': 'Voraussichtliche Kosten',
    'kpi.upcoming_provider': 'Anstehend',
    'kpi.done': 'Erledigt',
    'kpi.remaining': 'Verbleibend',

    // Prop detail (missing)
    'prop.detail.saved': 'Unterkunft gespeichert',
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

function setLangPremium(lang) {
  // Premium languages require premium plan
  if (typeof API !== 'undefined' && !API.isPremium()) {
    if (typeof showPremiumModal === 'function') {
      showPremiumModal('Les langues supplementaires (ES, PT, IT, DE) sont reservees aux utilisateurs Premium.');
    }
    return;
  }
  setLang(lang);
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
  // Update lang button if exists
  if (typeof updateLangButton === 'function') updateLangButton();
  // Update login flag selection
  document.querySelectorAll('.lang-flag').forEach(el => {
    const isActive = el.getAttribute('data-lang') === lang;
    el.style.border = isActive ? '2px solid var(--accent)' : '2px solid transparent';
    el.style.background = isActive ? 'rgba(233,69,96,0.15)' : 'none';
    el.style.transform = isActive ? 'scale(1.1)' : 'scale(1)';
    el.style.opacity = isActive ? '1' : '0.5';
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
