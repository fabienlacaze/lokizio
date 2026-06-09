# Setup pg_cron + Edge Function (gratuit)

## Pourquoi
Remplace le cron GitHub Actions ($7.70/mois) par Supabase gratuit.
Refresh les calendriers iCal (Airbnb/Booking) toutes les 2 heures.

## Couts
- Edge Functions: 500K invocations/mois gratuites. On utilise ~360/mois.
- pg_cron: Inclus gratuitement.
- **Total: 0 EUR/mois**

## Etapes

### 1. Deployer l'Edge Function

Option A: Via Supabase CLI (si installe)
```bash
cd MenageManager
supabase link --project-ref mrvejwyvhuivmipfwlzz
supabase functions deploy refresh-ical
```

Option B: Via le Dashboard Supabase
1. Aller sur https://supabase.com/dashboard/project/mrvejwyvhuivmipfwlzz/functions
2. Cliquer "Create a new function"
3. Nom: `refresh-ical`
4. Copier le contenu de `functions/refresh-ical/index.ts`
5. Deploy

### 2. Configurer pg_cron

1. Aller sur https://supabase.com/dashboard/project/mrvejwyvhuivmipfwlzz/sql
2. Copier-coller le contenu de `setup-cron.sql`
3. Executer
4. Verifier que le job apparait dans la table `cron.job`

### 3. Verifier que ca marche

```sql
-- Voir les derniers runs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
```

### 4. Pour desactiver (si besoin)

```sql
SELECT cron.unschedule('refresh-ical-every-2h');
```

## Limites de securite
- MAX_PROPERTIES = 500 par invocation (garde-fou)
- Auth par service_role_key (pas accessible publiquement)
- Si Supabase change ses limites, le cron peut etre desactive en 1 ligne SQL
