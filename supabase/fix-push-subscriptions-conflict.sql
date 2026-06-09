-- ══════════════════════════════════════════════════════════════
-- Fix conflit 409 sur push_subscriptions
-- ══════════════════════════════════════════════════════════════
-- PROBLEME :
-- Le code (push.js:23-29) faisait :
--   .upsert({...}, { onConflict: 'endpoint' })
-- Mais la contrainte UNIQUE en DB etait sur user_id.
-- Resultat : Postgres retourne HTTP 409 Conflict car il ne peut pas
-- resoudre l'upsert via la cle indiquee.
--
-- De plus, la contrainte UNIQUE sur user_id empechait un user
-- d'avoir plusieurs devices (telephone + ordinateur + tablette).
--
-- SOLUTION :
-- - Retirer UNIQUE sur user_id (autoriser multi-device)
-- - Ajouter UNIQUE sur endpoint (un endpoint = un device unique)
-- - Garder un index sur user_id pour les SELECT par user
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_key;

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);

CREATE INDEX IF NOT EXISTS idx_push_subs_user_id
  ON public.push_subscriptions(user_id);

-- Verification
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.push_subscriptions'::regclass;
