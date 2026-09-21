-- Historique des parties, pour le panneau admin.
--
-- Jusqu'ici le site comptait les parties PAR JEU (games.plays), jamais par
-- joueur : impossible de dire combien de parties quelqu'un a faites, ni a
-- quelle heure il a joue la derniere fois. Cette table garde une ligne par
-- partie lancee, et c'est la fonction increment_plays qui l'ecrit — donc
-- aucun changement dans les jeux eux-memes.
--
-- Les visiteurs sans compte ne laissent rien : on n'a pas d'identifiant a
-- mettre, et on ne cherche pas a les suivre.

create table if not exists public.play_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id uuid references public.games (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists play_log_user_idx on public.play_log (user_id, created_at desc);

alter table public.play_log enable row level security;

-- Chacun ne voit que ses propres parties. Le panneau admin lit avec la cle
-- secrete, qui passe au-dessus de cette regle.
drop policy if exists "play_log lecture perso" on public.play_log;
create policy "play_log lecture perso" on public.play_log for select using (auth.uid() = user_id);

-- La fonction qui compte deja les parties enregistre maintenant aussi qui a
-- joue. Elle tourne en security definer : personne ne peut ecrire une ligne
-- au nom de quelqu'un d'autre.
create or replace function public.increment_plays(game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.games set plays = plays + 1 where id = game_id and published = true;
  if auth.uid() is not null then
    insert into public.play_log (user_id, game_id) values (auth.uid(), game_id);
  end if;
end;
$$;

grant execute on function public.increment_plays(uuid) to anon, authenticated;

-- Resume par joueur : nombre de parties, date de la derniere, et le jeu.
-- security_invoker : la vue obeit aux regles ci-dessus, elle n'ouvre rien.
create or replace view public.play_stats with (security_invoker = on) as
select
  l.user_id,
  count(*)::int as parties,
  max(l.created_at) as derniere,
  (
    select coalesce(g.title, '(jeu supprimé)')
    from public.play_log l2
    left join public.games g on g.id = l2.game_id
    where l2.user_id = l.user_id
    order by l2.created_at desc
    limit 1
  ) as dernier_jeu
from public.play_log l
group by l.user_id;
