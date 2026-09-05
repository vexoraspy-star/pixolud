-- 1. Colonne pour stocker l'URL de l'image de couverture uploadée
alter table public.games
  add column if not exists cover_url text;

-- 2. Bucket de stockage pour les images de couverture (public en lecture)
insert into storage.buckets (id, name, public)
values ('game-covers', 'game-covers', true)
on conflict (id) do nothing;

-- 3. Tout le monde peut voir les images (bucket public)
create policy "Les couvertures de jeux sont publiques"
on storage.objects for select
using (bucket_id = 'game-covers');

-- 4. Un utilisateur connecté ne peut uploader/modifier/supprimer que dans
--    son propre dossier (préfixé par son id), pour éviter qu'il touche aux
--    fichiers des autres.
create policy "Un utilisateur uploade dans son propre dossier"
on storage.objects for insert
with check (
  bucket_id = 'game-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Un utilisateur remplace ses propres fichiers"
on storage.objects for update
using (
  bucket_id = 'game-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Un utilisateur supprime ses propres fichiers"
on storage.objects for delete
using (
  bucket_id = 'game-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
);
