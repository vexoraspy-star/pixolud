-- Quelques jeux de démo pour voir le catalogue fonctionner avant que
-- l'éditeur de jeux n'existe. À supprimer plus tard si besoin (Table Editor
-- → games → sélectionner les lignes → Delete rows).

insert into public.games (slug, title, description, category, author_id, gradient, emoji, plays, published)
values
  (
    'sauts-de-cristal',
    'Sauts de Cristal',
    'Un jeu de plateforme où tu dois sauter de plateforme en plateforme pour collecter des cristaux avant la fin du temps imparti.',
    'Plateforme',
    '1ccff1ed-0197-402e-ad12-ef6e884f0119',
    'from-violet-500 to-fuchsia-500',
    '💎',
    124,
    true
  ),
  (
    'labyrinthe-des-ombres',
    'Le Labyrinthe des Ombres',
    'Trouve la sortie d''un labyrinthe généré aléatoirement avant que la lumière ne s''éteigne complètement.',
    'Labyrinthe',
    '1ccff1ed-0197-402e-ad12-ef6e884f0119',
    'from-slate-700 to-slate-900',
    '🌀',
    82,
    true
  ),
  (
    'invasion-pixel',
    'Invasion Pixel',
    'Un clone arcade façon envahisseurs de l''espace avec des power-ups et 15 vagues d''ennemis.',
    'Arcade',
    '58cefcc7-c090-4f80-869f-c07568e12155',
    'from-emerald-400 to-teal-500',
    '👾',
    305,
    true
  ),
  (
    'casse-bulles',
    'Casse-Bulles',
    'Aligne trois bulles de la même couleur ou plus pour les faire exploser. 60 niveaux de puzzle.',
    'Puzzle',
    '58cefcc7-c090-4f80-869f-c07568e12155',
    'from-sky-400 to-cyan-500',
    '🫧',
    156,
    true
  ),
  (
    'quiz-culture-generale',
    'Quiz Culture Générale',
    '200 questions réparties en 10 catégories pour tester tes connaissances contre le chrono.',
    'Quiz',
    'c8836994-53ac-41ef-8aca-8fb1c11ec747',
    'from-amber-400 to-orange-500',
    '🧠',
    203,
    true
  ),
  (
    'course-des-meteores',
    'Course des Météores',
    'Évite les météores et termine premier dans cette course arcade en vue de dessus.',
    'Course',
    'c8836994-53ac-41ef-8aca-8fb1c11ec747',
    'from-red-500 to-rose-600',
    '🚀',
    98,
    true
  );
