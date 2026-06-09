# Process de notification de violation de données — Lokizio

> Conformément à l'article 33 du RGPD et à l'article 16 du Digital Services Act, voici la procédure interne de Lokizio en cas de violation de données personnelles. Ce document est versionné dans le repo public pour transparence et auditabilité.

## ⏰ Délai : 72 heures (RGPD art. 33)

Toute violation susceptible d'entraîner un risque pour les droits et libertés des personnes physiques doit être notifiée à la CNIL **dans les 72 heures** suivant sa découverte (calendaires, week-ends inclus).

Si le délai n'est pas tenu, justifier explicitement le retard dans la notification.

## 🚦 Étape 0 — Découverte

Source possible :
- Détection automatique (Sentry alerte, audit_log severity=critical)
- Signalement utilisateur (security@lokizio.com ou contact@lokizio.com)
- Audit interne périodique
- Notification d'un sous-traitant (Stripe, Supabase, Resend)

**Action immédiate** : créer une entrée dans `security_incidents` via Mon compte > ADMIN > Incidents sécurité. Champs minimum :
- category
- severity
- description (5W : Qui Quoi Où Quand Comment)
- occurred_at (estimation)
- affected_users_count (si connu)

## 🛑 Étape 1 — Confinement (heures 0-4)

1. Identifier le scope précis (combien d'utilisateurs ? quelles données ?)
2. **Stopper l'hémorragie** : désactiver l'attaque (révoquer tokens, fermer endpoint compromis, fermer compte attaquant)
3. Préserver les preuves (logs, audit_log, captures Sentry)
4. **Ne pas effacer** les traces — même si elles sont gênantes

## 📊 Étape 2 — Évaluation du risque (heures 4-24)

Évaluer si la violation représente **un risque** ou **un risque élevé** pour les personnes.

| Type de données fuite | Risque |
|---|---|
| Email + nom | Faible (notification CNIL "sans tarder") |
| Email + numéro de téléphone + adresse | Moyen |
| Données bancaires partielles (IBAN, carte) | Élevé |
| Données KYC (CNI, justificatifs) | Élevé |
| Mots de passe en clair (impossible — hash bcrypt) | Critique |
| Données de santé / mineurs | Critique |

**Si risque élevé** → notifier la CNIL **et** les utilisateurs affectés.

## 📩 Étape 3 — Notification CNIL (heures 24-72)

Via le portail : https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles

Contenu minimum (RGPD art. 33.3) :
1. Nature de la violation (catégorisation, type)
2. Catégories et nombre approximatif de personnes concernées
3. Catégories et volume approximatif d'enregistrements concernés
4. Conséquences probables
5. Mesures prises ou proposées pour atténuer
6. Coordonnées du DPO

Marquer dans `security_incidents` :
- `cnil_notification_required = true`
- `cnil_notification_sent_at = NOW()`
- `cnil_notification_reference = <ack de la CNIL>`

## 👥 Étape 4 — Notification utilisateurs affectés (si risque élevé)

Via Edge Function `send-email` avec template breach_notification (à créer).

Contenu minimum :
- Description claire de la nature de la violation (pas de jargon)
- Nom + coordonnées DPO
- Conséquences probables pour eux
- Mesures recommandées (changer mot de passe, surveiller compte bancaire)
- Marquer `affected_users_notified_at = NOW()`

## 🛠️ Étape 5 — Remédiation

1. Identifier la cause racine (5 whys)
2. Déployer le fix
3. Ajouter test de non-régression
4. Réviser les RLS / contrôles si applicable
5. Marquer `contained_at` puis `resolved_at` + `resolution_summary`

## 📚 Étape 6 — Documentation post-mortem

Pour les violations **medium et plus**, rédiger un post-mortem public (anonymisé) sur le repo ou STATUS.md :
- Timeline détaillée
- Cause racine
- Impact réel
- Mesures correctives
- Engagement futur

## 🧰 Outils Lokizio

- **Sentry** : detection erreurs runtime
- **audit_log** : tracabilité actions sensibles
- **security_incidents** : registre formel des incidents
- **profile_reports** : signalements utilisateurs (DSA art. 16)
- **security.txt** : canal responsible disclosure

## 📞 Contacts

- DPO : dpo@lokizio.com
- DSA contact : dsa@lokizio.com
- Sécurité technique : security@lokizio.com (ou fabien65400@hotmail.fr)
- CNIL : https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles

---

*Dernière mise à jour : 2026-06-09 (v9.76)*
*Document versionné : https://github.com/fabienlacaze/lokizio/blob/main/BREACH_NOTIFICATION_PROCESS.md*
