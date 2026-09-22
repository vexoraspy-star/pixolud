-- Regles de securite : meme logique, evaluee une seule fois par requete.
--
-- Ecrite `auth.uid() = user_id`, une regle rappelle la fonction POUR CHAQUE
-- LIGNE examinee. Ecrite `(select auth.uid()) = user_id`, Postgres la calcule
-- une fois et compare ensuite. C'est ce que signale l'Advisor de Supabase
-- sous le nom « Auth RLS Initialization Plan ».
--
-- Ce fichier ne change RIEN aux droits : chaque regle est recreee avec
-- exactement la meme condition, seule l'ecriture de auth.uid() change. Il est
-- rejouable sans risque (chaque regle est supprimee puis recreee).
--
-- A lancer une fois dans Supabase : SQL Editor -> New query -> Run.

-- ------------------------------------------------------------- profils

drop policy if exists "Un utilisateur modifie uniquement son propre profil" on public.profiles;
create policy "Un utilisateur modifie uniquement son propre profil"
  on public.profiles for update
  using ((select auth.uid()) = id and not public.is_banned((select auth.uid())));

-- --------------------------------------------------------------- jeux

drop policy if exists "Les jeux publiés sont visibles par tous, les brouillons par leur auteur" on public.games;
create policy "Les jeux publiés sont visibles par tous, les brouillons par leur auteur"
  on public.games for select
  using (published = true or (select auth.uid()) = author_id);

drop policy if exists "Un utilisateur connecté peut créer un jeu" on public.games;
create policy "Un utilisateur connecté peut créer un jeu"
  on public.games for insert
  with check ((select auth.uid()) = author_id and not public.is_banned((select auth.uid())));

drop policy if exists "Un auteur peut modifier ou supprimer son propre jeu" on public.games;
create policy "Un auteur peut modifier ou supprimer son propre jeu"
  on public.games for update
  using ((select auth.uid()) = author_id and not public.is_banned((select auth.uid())));

drop policy if exists "Un auteur peut supprimer son propre jeu" on public.games;
create policy "Un auteur peut supprimer son propre jeu"
  on public.games for delete
  using ((select auth.uid()) = author_id);

-- ------------------------------------------------------- commentaires

drop policy if exists "Un utilisateur connecté peut commenter" on public.comments;
create policy "Un utilisateur connecté peut commenter"
  on public.comments for insert
  with check ((select auth.uid()) = author_id and not public.is_banned((select auth.uid())));

drop policy if exists "Un utilisateur peut supprimer son propre commentaire" on public.comments;
create policy "Un utilisateur peut supprimer son propre commentaire"
  on public.comments for delete
  using ((select auth.uid()) = author_id);

-- --------------------------------------------------------------- notes

drop policy if exists "Un utilisateur connecté peut noter un jeu" on public.ratings;
create policy "Un utilisateur connecté peut noter un jeu"
  on public.ratings for insert
  with check ((select auth.uid()) = user_id and not public.is_banned((select auth.uid())));

drop policy if exists "Un utilisateur peut modifier sa propre note" on public.ratings;
create policy "Un utilisateur peut modifier sa propre note"
  on public.ratings for update
  using ((select auth.uid()) = user_id and not public.is_banned((select auth.uid())));

-- ---------------------------------------------------------------- amis

drop policy if exists "Voir ses amities" on public.friendships;
create policy "Voir ses amities"
  on public.friendships for select
  using ((select auth.uid()) = a_id or (select auth.uid()) = b_id);

drop policy if exists "Demander en ami" on public.friendships;
create policy "Demander en ami"
  on public.friendships for insert
  with check (
    ((select auth.uid()) = a_id or (select auth.uid()) = b_id)
    and (select auth.uid()) = requested_by
    and status = 'en_attente'
    and not public.is_banned((select auth.uid()))
  );

drop policy if exists "Repondre a une demande" on public.friendships;
create policy "Repondre a une demande"
  on public.friendships for update
  using (((select auth.uid()) = a_id or (select auth.uid()) = b_id) and (select auth.uid()) <> requested_by)
  with check (status = 'acceptee');

drop policy if exists "Retirer un ami" on public.friendships;
create policy "Retirer un ami"
  on public.friendships for delete
  using ((select auth.uid()) = a_id or (select auth.uid()) = b_id);

-- ------------------------------------------------------------ messages

drop policy if exists "Lire ses conversations" on public.messages;
create policy "Lire ses conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.friendships f
      where f.id = friendship_id
        and f.status = 'acceptee'
        and ((select auth.uid()) = f.a_id or (select auth.uid()) = f.b_id)
    )
  );

drop policy if exists "Ecrire a un ami" on public.messages;
create policy "Ecrire a un ami"
  on public.messages for insert
  with check (
    (select auth.uid()) = sender_id
    and not public.is_banned((select auth.uid()))
    and exists (
      select 1 from public.friendships f
      where f.id = friendship_id
        and f.status = 'acceptee'
        and ((select auth.uid()) = f.a_id or (select auth.uid()) = f.b_id)
    )
  );

drop policy if exists "Supprimer son message" on public.messages;
create policy "Supprimer son message"
  on public.messages for delete
  using ((select auth.uid()) = sender_id);

-- ------------------------------------------------------------- favoris

drop policy if exists "Favoris : les miens" on public.favorites;
create policy "Favoris : les miens" on public.favorites
for select using ((select auth.uid()) = user_id);

drop policy if exists "Favoris : j'ajoute les miens" on public.favorites;
create policy "Favoris : j'ajoute les miens" on public.favorites
for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Favoris : j'enleve les miens" on public.favorites;
create policy "Favoris : j'enleve les miens" on public.favorites
for delete using ((select auth.uid()) = user_id);

-- -------------------------------------------------- historique des parties

drop policy if exists "play_log lecture perso" on public.play_log;
create policy "play_log lecture perso" on public.play_log
for select using ((select auth.uid()) = user_id);

-- --------------------------------------------------------------- party

drop policy if exists "Party : visible par ses membres" on public.parties;
create policy "Party : visible par ses membres" on public.parties
for select using (public.est_membre_party(id) or leader_id = (select auth.uid()));

drop policy if exists "Party : creee par son chef" on public.parties;
create policy "Party : creee par son chef" on public.parties
for insert with check (leader_id = (select auth.uid()));

drop policy if exists "Party : le chef la modifie" on public.parties;
create policy "Party : le chef la modifie" on public.parties
for update using (leader_id = (select auth.uid()));

drop policy if exists "Party : le chef la dissout" on public.parties;
create policy "Party : le chef la dissout" on public.parties
for delete using (leader_id = (select auth.uid()));

drop policy if exists "Membres : visibles entre membres" on public.party_members;
create policy "Membres : visibles entre membres" on public.party_members
for select using (public.est_membre_party(party_id) or user_id = (select auth.uid()));

drop policy if exists "Membres : ajout par le chef ou soi-meme" on public.party_members;
create policy "Membres : ajout par le chef ou soi-meme" on public.party_members
for insert with check (
  user_id = (select auth.uid())
  or exists (select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid()))
);

drop policy if exists "Membres : partir ou etre exclu" on public.party_members;
create policy "Membres : partir ou etre exclu" on public.party_members
for delete using (
  user_id = (select auth.uid())
  or exists (select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid()))
);

drop policy if exists "Messages : ecrits par les membres" on public.party_messages;
create policy "Messages : ecrits par les membres" on public.party_messages
for insert with check (sender_id = (select auth.uid()) and public.est_membre_party(party_id));

-- ------------------------------------------------------------- avatars

drop policy if exists "Avatar : chacun dans son dossier" on storage.objects;
create policy "Avatar : chacun dans son dossier"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

drop policy if exists "Avatar : remplacer le sien" on storage.objects;
create policy "Avatar : remplacer le sien"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

drop policy if exists "Avatar : supprimer le sien" on storage.objects;
create policy "Avatar : supprimer le sien"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

-- ------------------------------------------ couvertures de jeux (images)

drop policy if exists "Un utilisateur uploade dans son propre dossier" on storage.objects;
create policy "Un utilisateur uploade dans son propre dossier"
on storage.objects for insert
with check (
  bucket_id = 'game-covers'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

drop policy if exists "Un utilisateur remplace ses propres fichiers" on storage.objects;
create policy "Un utilisateur remplace ses propres fichiers"
on storage.objects for update
using (
  bucket_id = 'game-covers'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

drop policy if exists "Un utilisateur supprime ses propres fichiers" on storage.objects;
create policy "Un utilisateur supprime ses propres fichiers"
on storage.objects for delete
using (
  bucket_id = 'game-covers'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);
