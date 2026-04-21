# Tests d'integration Lokizio

Ces tests parlent a un **vrai projet Supabase** (dedie, pas la prod) pour verifier :
- Les **RLS policies** par role (tenant, concierge, provider, owner)
- Les **contraintes DB** (CHECK, UNIQUE, FK)
- Les **workflows end-to-end** (creer org, facture, reservation...)

Contrairement aux tests unitaires (instantanes, pas de reseau), ces tests sont plus lents (~30s-2min) et nécessitent un setup en 3 étapes.

## Setup (5 minutes, une seule fois)

### 1. Creer un projet Supabase dedie aux tests

1. Va sur [app.supabase.com/dashboard](https://app.supabase.com/dashboard)
2. **New project** > Nom: `lokizio-test` > Region: **West Europe (London)** (meme que prod) > plan Free
3. Attends ~2 minutes que le projet soit ready

### 2. Appliquer le schema

1. Dans le dashboard du projet `lokizio-test` : **SQL Editor**
2. Colle le contenu de [`../../../supabase/test-schema-bootstrap.sql`](../../supabase/test-schema-bootstrap.sql)
3. Clique **Run**. Tu dois avoir `Success. No rows returned`

### 3. Recuperer les cles et creer `.env.test`

1. Dans ton projet test : **Settings > API**
2. Copie :
   - `Project URL` (ex: `https://xxxx.supabase.co`)
   - `anon public` key (commence par `eyJ...`)
   - `service_role` key (**secret**, commence par `eyJ...`)
3. A la racine de `menage-manager-app/` :
   ```bash
   cp .env.test.example .env.test
   ```
4. Edite `.env.test` et colle tes 3 valeurs

## Lancer les tests

```bash
# Tests d'integration seuls
npm run test:integration

# Ou via l'audit (inclut les tests d'integration si .env.test existe)
npm run audit
```

## Ce qui est teste

| Fichier | Verifie |
|---------|---------|
| `rls.test.js` | Isolation entre orgs, roles provider/concierge sur service_requests |
| `invoices.test.js` | CRUD factures + contraintes CHECK statut/type |
| `tenant-messages.test.js` | Fuite corrigee : tenant A ne voit PAS les messages de tenant B |
| `connections.test.js` | Index unique empeche les doublons de connection_requests |

Chaque test **cree ses propres donnees** (user + org) et **nettoie a la fin** (cascade delete). Ca evite la pollution cross-tests.

## Notes

- **Ne jamais pointer `.env.test` vers la prod** : les tests suppriment des users et organisations
- Le projet test consomme ~10MB de DB et envoie ~100 requetes par run. Largement dans le plan Free (500MB / 50k requ/jour)
- Si un test echoue a mi-chemin et laisse des orphelins, tu peux re-run le SQL suivant pour nettoyer :
  ```sql
  DELETE FROM organizations WHERE name LIKE 'TestOrg-%';
  ```
  (le schema utilise des noms prefixes pour rendre le cleanup facile)
