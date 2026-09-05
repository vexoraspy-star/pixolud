-- Système d'abonnement (sans paiement réel pour l'instant).
-- "tier" est géré manuellement en attendant l'intégration Stripe : soit
-- directement dans Table Editor → profiles → tier, soit via une future
-- page de paiement qui appellera le même champ.

alter table public.profiles
  add column if not exists tier text not null default 'free'
  check (tier in ('free', 'standard', 'max'));
