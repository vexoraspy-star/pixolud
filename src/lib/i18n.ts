export const LOCALES = ["fr", "en", "de", "es", "ru", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";
export const LANG_COOKIE = "pixolud_lang";

export const LANGUAGE_META: Record<Locale, { label: string; flag: string; dir: "ltr" | "rtl" }> = {
  fr: { label: "Français", flag: "🇫🇷", dir: "ltr" },
  en: { label: "English", flag: "🇬🇧", dir: "ltr" },
  de: { label: "Deutsch", flag: "🇩🇪", dir: "ltr" },
  es: { label: "Español", flag: "🇪🇸", dir: "ltr" },
  ru: { label: "Русский", flag: "🇷🇺", dir: "ltr" },
  ar: { label: "العربية", flag: "🇸🇦", dir: "rtl" },
};

export function isLocale(v: string | undefined | null): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

type Dict = Record<string, string>;

const fr: Dict = {
  "nav.catalogue": "Catalogue",
  "nav.mode3d": "Mode 3D",
  "nav.multiplayer": "Multijoueur",
  "nav.createGame": "Créer un jeu",
  "nav.premium": "✨ Premium",
  "nav.settings": "Paramètres",
  "nav.logout": "Se déconnecter",
  "nav.login": "Se connecter",
  "nav.signup": "Créer un compte",
  "nav.searchPlaceholder": "Rechercher un jeu...",
  "common.by": "par",

  "footer.rights": "Fait par la communauté.",
  "footer.cgu": "CGU",
  "footer.privacy": "Confidentialité",
  "footer.report": "Signaler un contenu",
  "footer.catalogue": "Catalogue",

  "home.title": "Crée, publie et joue à des mini-jeux 2D",
  "home.subtitle":
    "Pixolud est la plateforme communautaire où n'importe qui peut imaginer un mini-jeu — plateforme, puzzle, arcade, labyrinthe, quiz — le publier et le faire découvrir à d'autres joueurs. Sans écrire une ligne de code.",
  "home.ctaSignup": "Créer un compte gratuitement",
  "home.ctaCreateGame": "Créer un jeu",
  "home.ctaExplore": "Explorer le catalogue",
  "home.searchPlaceholder": "Rechercher un jeu, un créateur...",
  "home.searchButton": "Rechercher",
  "home.statsGames": "jeux publiés",
  "home.statsGame": "jeu publié",
  "home.statsMembers": "membres",
  "home.statsMember": "membre",
  "home.statsPlays": "parties jouées",
  "home.statsPlay": "partie jouée",
  "home.gameOfDay": "🎲 Jeu du jour",
  "home.featured": "👑 Mis en avant",
  "home.recent": "🆕 Ajoutés récemment",
  "home.popular": "🔥 Jeux populaires",
  "home.topRated": "⭐ Les mieux notés",
  "home.seeAll": "Voir tout →",
  "home.emptyState": "Aucun jeu publié pour l'instant — sois le premier à en créer un !",
  "home.bottomTitle": "Envie de créer ton propre jeu ?",
  "home.bottomTextLoggedIn": "Direction l'éditeur pour créer et publier ton prochain mini-jeu.",
  "home.bottomTextLoggedOut":
    "Rejoins la communauté et publie ton premier mini-jeu en quelques minutes grâce à notre éditeur simple, sans code.",
  "home.bottomButton": "Commencer maintenant",

  "auth.loginTitle": "Se connecter",
  "auth.loginSubtitle": "Content de te revoir !",
  "auth.email": "Adresse email",
  "auth.password": "Mot de passe",
  "auth.forgotPassword": "Mot de passe oublié ?",
  "auth.loginButton": "Se connecter",
  "auth.noAccount": "Pas encore de compte ?",
  "auth.createAccount": "Créer un compte",

  "auth.signupTitle": "Créer un compte",
  "auth.signupSubtitle": "Rejoins la communauté pour créer, publier et jouer à des mini-jeux.",
  "auth.pseudo": "Pseudo",
  "auth.pseudoPlaceholder": "Ton pseudo public",
  "auth.passwordPlaceholder": "8 caractères minimum",
  "auth.acceptCguPrefix": "J'ai lu et j'accepte les",
  "auth.cguLink": "Conditions Générales d'Utilisation",
  "auth.and": "et la",
  "auth.privacyLink": "Politique de Confidentialité",
  "auth.signupButton": "Créer mon compte",
  "auth.haveAccount": "Déjà un compte ?",

  "auth.forgotTitle": "Mot de passe oublié",
  "auth.forgotSubtitle": "Indique ton adresse email, on t'enverra un lien de réinitialisation.",
  "auth.sendResetLink": "Envoyer le lien de réinitialisation",
  "auth.backToLogin": "← Retour à la connexion",

  "auth.resetTitle": "Choisis un nouveau mot de passe",
  "auth.newPassword": "Nouveau mot de passe",
  "auth.updatePassword": "Mettre à jour le mot de passe",

  "auth.checkEmailTitle": "Vérifie ta boîte mail",
  "auth.checkEmailSignup":
    "On vient de t'envoyer un lien de confirmation. Clique dessus pour activer ton compte et te connecter.",
  "auth.checkEmailReset":
    "Si un compte existe avec cette adresse, un lien de réinitialisation vient de t'être envoyé.",

  "lang.choose": "Choisir la langue",
};

const en: Dict = {
  "nav.catalogue": "Catalogue",
  "nav.mode3d": "3D Mode",
  "nav.multiplayer": "Multiplayer",
  "nav.createGame": "Create a game",
  "nav.premium": "✨ Premium",
  "nav.settings": "Settings",
  "nav.logout": "Log out",
  "nav.login": "Log in",
  "nav.signup": "Sign up",
  "nav.searchPlaceholder": "Search a game...",
  "common.by": "by",

  "footer.rights": "Made by the community.",
  "footer.cgu": "Terms",
  "footer.privacy": "Privacy",
  "footer.report": "Report content",
  "footer.catalogue": "Catalogue",

  "home.title": "Create, publish, and play 2D mini-games",
  "home.subtitle":
    "Pixolud is the community platform where anyone can imagine a mini-game — platformer, puzzle, arcade, maze, quiz — publish it and get it discovered by other players. No coding required.",
  "home.ctaSignup": "Create a free account",
  "home.ctaCreateGame": "Create a game",
  "home.ctaExplore": "Explore the catalogue",
  "home.searchPlaceholder": "Search a game, a creator...",
  "home.searchButton": "Search",
  "home.statsGames": "published games",
  "home.statsGame": "published game",
  "home.statsMembers": "members",
  "home.statsMember": "member",
  "home.statsPlays": "plays",
  "home.statsPlay": "play",
  "home.gameOfDay": "🎲 Game of the day",
  "home.featured": "👑 Featured",
  "home.recent": "🆕 Recently added",
  "home.popular": "🔥 Popular games",
  "home.topRated": "⭐ Top rated",
  "home.seeAll": "See all →",
  "home.emptyState": "No games published yet — be the first to create one!",
  "home.bottomTitle": "Want to create your own game?",
  "home.bottomTextLoggedIn": "Head to the editor to create and publish your next mini-game.",
  "home.bottomTextLoggedOut":
    "Join the community and publish your first mini-game in minutes with our simple, no-code editor.",
  "home.bottomButton": "Get started now",

  "auth.loginTitle": "Log in",
  "auth.loginSubtitle": "Welcome back!",
  "auth.email": "Email address",
  "auth.password": "Password",
  "auth.forgotPassword": "Forgot password?",
  "auth.loginButton": "Log in",
  "auth.noAccount": "No account yet?",
  "auth.createAccount": "Create an account",

  "auth.signupTitle": "Create an account",
  "auth.signupSubtitle": "Join the community to create, publish, and play mini-games.",
  "auth.pseudo": "Username",
  "auth.pseudoPlaceholder": "Your public username",
  "auth.passwordPlaceholder": "8 characters minimum",
  "auth.acceptCguPrefix": "I have read and accept the",
  "auth.cguLink": "Terms of Service",
  "auth.and": "and the",
  "auth.privacyLink": "Privacy Policy",
  "auth.signupButton": "Create my account",
  "auth.haveAccount": "Already have an account?",

  "auth.forgotTitle": "Forgot password",
  "auth.forgotSubtitle": "Enter your email address, we'll send you a reset link.",
  "auth.sendResetLink": "Send reset link",
  "auth.backToLogin": "← Back to login",

  "auth.resetTitle": "Choose a new password",
  "auth.newPassword": "New password",
  "auth.updatePassword": "Update password",

  "auth.checkEmailTitle": "Check your inbox",
  "auth.checkEmailSignup":
    "We just sent you a confirmation link. Click it to activate your account and log in.",
  "auth.checkEmailReset":
    "If an account exists with that address, a reset link has just been sent to you.",

  "lang.choose": "Choose language",
};

const de: Dict = {
  "nav.catalogue": "Katalog",
  "nav.mode3d": "3D-Modus",
  "nav.multiplayer": "Mehrspieler",
  "nav.createGame": "Spiel erstellen",
  "nav.premium": "✨ Premium",
  "nav.settings": "Einstellungen",
  "nav.logout": "Abmelden",
  "nav.login": "Anmelden",
  "nav.signup": "Konto erstellen",
  "nav.searchPlaceholder": "Spiel suchen...",
  "common.by": "von",

  "footer.rights": "Von der Community erstellt.",
  "footer.cgu": "AGB",
  "footer.privacy": "Datenschutz",
  "footer.report": "Inhalt melden",
  "footer.catalogue": "Katalog",

  "home.title": "Erstelle, veröffentliche und spiele 2D-Minispiele",
  "home.subtitle":
    "Pixolud ist die Community-Plattform, auf der jeder ein Minispiel erdenken kann — Plattformer, Puzzle, Arcade, Labyrinth, Quiz —, es veröffentlichen und von anderen Spielern entdecken lassen kann. Ganz ohne Programmierung.",
  "home.ctaSignup": "Kostenloses Konto erstellen",
  "home.ctaCreateGame": "Spiel erstellen",
  "home.ctaExplore": "Katalog entdecken",
  "home.searchPlaceholder": "Spiel oder Ersteller suchen...",
  "home.searchButton": "Suchen",
  "home.statsGames": "veröffentlichte Spiele",
  "home.statsGame": "veröffentlichtes Spiel",
  "home.statsMembers": "Mitglieder",
  "home.statsMember": "Mitglied",
  "home.statsPlays": "gespielte Partien",
  "home.statsPlay": "gespielte Partie",
  "home.gameOfDay": "🎲 Spiel des Tages",
  "home.featured": "👑 Hervorgehoben",
  "home.recent": "🆕 Kürzlich hinzugefügt",
  "home.popular": "🔥 Beliebte Spiele",
  "home.topRated": "⭐ Bestbewertet",
  "home.seeAll": "Alle ansehen →",
  "home.emptyState": "Noch keine Spiele veröffentlicht — sei der Erste!",
  "home.bottomTitle": "Lust, dein eigenes Spiel zu erstellen?",
  "home.bottomTextLoggedIn": "Ab in den Editor, um dein nächstes Minispiel zu erstellen und zu veröffentlichen.",
  "home.bottomTextLoggedOut":
    "Tritt der Community bei und veröffentliche dein erstes Minispiel in wenigen Minuten mit unserem einfachen Editor ohne Code.",
  "home.bottomButton": "Jetzt loslegen",

  "auth.loginTitle": "Anmelden",
  "auth.loginSubtitle": "Schön, dich wiederzusehen!",
  "auth.email": "E-Mail-Adresse",
  "auth.password": "Passwort",
  "auth.forgotPassword": "Passwort vergessen?",
  "auth.loginButton": "Anmelden",
  "auth.noAccount": "Noch kein Konto?",
  "auth.createAccount": "Konto erstellen",

  "auth.signupTitle": "Konto erstellen",
  "auth.signupSubtitle": "Tritt der Community bei, um Minispiele zu erstellen, zu veröffentlichen und zu spielen.",
  "auth.pseudo": "Benutzername",
  "auth.pseudoPlaceholder": "Dein öffentlicher Benutzername",
  "auth.passwordPlaceholder": "Mindestens 8 Zeichen",
  "auth.acceptCguPrefix": "Ich habe die",
  "auth.cguLink": "Allgemeinen Geschäftsbedingungen",
  "auth.and": "und die",
  "auth.privacyLink": "Datenschutzrichtlinie",
  "auth.signupButton": "Konto erstellen",
  "auth.haveAccount": "Bereits ein Konto?",

  "auth.forgotTitle": "Passwort vergessen",
  "auth.forgotSubtitle": "Gib deine E-Mail-Adresse ein, wir senden dir einen Link zum Zurücksetzen.",
  "auth.sendResetLink": "Link zum Zurücksetzen senden",
  "auth.backToLogin": "← Zurück zur Anmeldung",

  "auth.resetTitle": "Neues Passwort wählen",
  "auth.newPassword": "Neues Passwort",
  "auth.updatePassword": "Passwort aktualisieren",

  "auth.checkEmailTitle": "Überprüfe dein Postfach",
  "auth.checkEmailSignup":
    "Wir haben dir gerade einen Bestätigungslink geschickt. Klicke darauf, um dein Konto zu aktivieren und dich anzumelden.",
  "auth.checkEmailReset":
    "Falls ein Konto mit dieser Adresse existiert, wurde dir gerade ein Link zum Zurücksetzen gesendet.",

  "lang.choose": "Sprache wählen",
};

const es: Dict = {
  "nav.catalogue": "Catálogo",
  "nav.mode3d": "Modo 3D",
  "nav.multiplayer": "Multijugador",
  "nav.createGame": "Crear un juego",
  "nav.premium": "✨ Premium",
  "nav.settings": "Ajustes",
  "nav.logout": "Cerrar sesión",
  "nav.login": "Iniciar sesión",
  "nav.signup": "Crear cuenta",
  "nav.searchPlaceholder": "Buscar un juego...",
  "common.by": "por",

  "footer.rights": "Hecho por la comunidad.",
  "footer.cgu": "Términos",
  "footer.privacy": "Privacidad",
  "footer.report": "Reportar contenido",
  "footer.catalogue": "Catálogo",

  "home.title": "Crea, publica y juega mini-juegos 2D",
  "home.subtitle":
    "Pixolud es la plataforma comunitaria donde cualquiera puede imaginar un mini-juego — plataformas, puzle, arcade, laberinto, quiz —, publicarlo y darlo a conocer a otros jugadores. Sin escribir una línea de código.",
  "home.ctaSignup": "Crear una cuenta gratis",
  "home.ctaCreateGame": "Crear un juego",
  "home.ctaExplore": "Explorar el catálogo",
  "home.searchPlaceholder": "Buscar un juego, un creador...",
  "home.searchButton": "Buscar",
  "home.statsGames": "juegos publicados",
  "home.statsGame": "juego publicado",
  "home.statsMembers": "miembros",
  "home.statsMember": "miembro",
  "home.statsPlays": "partidas jugadas",
  "home.statsPlay": "partida jugada",
  "home.gameOfDay": "🎲 Juego del día",
  "home.featured": "👑 Destacados",
  "home.recent": "🆕 Añadidos recientemente",
  "home.popular": "🔥 Juegos populares",
  "home.topRated": "⭐ Mejor valorados",
  "home.seeAll": "Ver todo →",
  "home.emptyState": "Aún no hay juegos publicados — ¡sé el primero en crear uno!",
  "home.bottomTitle": "¿Quieres crear tu propio juego?",
  "home.bottomTextLoggedIn": "Ve al editor para crear y publicar tu próximo mini-juego.",
  "home.bottomTextLoggedOut":
    "Únete a la comunidad y publica tu primer mini-juego en minutos con nuestro editor simple, sin código.",
  "home.bottomButton": "Empezar ahora",

  "auth.loginTitle": "Iniciar sesión",
  "auth.loginSubtitle": "¡Qué bueno verte de nuevo!",
  "auth.email": "Correo electrónico",
  "auth.password": "Contraseña",
  "auth.forgotPassword": "¿Olvidaste tu contraseña?",
  "auth.loginButton": "Iniciar sesión",
  "auth.noAccount": "¿Aún no tienes cuenta?",
  "auth.createAccount": "Crear una cuenta",

  "auth.signupTitle": "Crear una cuenta",
  "auth.signupSubtitle": "Únete a la comunidad para crear, publicar y jugar mini-juegos.",
  "auth.pseudo": "Nombre de usuario",
  "auth.pseudoPlaceholder": "Tu nombre de usuario público",
  "auth.passwordPlaceholder": "8 caracteres mínimo",
  "auth.acceptCguPrefix": "He leído y acepto los",
  "auth.cguLink": "Términos y Condiciones",
  "auth.and": "y la",
  "auth.privacyLink": "Política de Privacidad",
  "auth.signupButton": "Crear mi cuenta",
  "auth.haveAccount": "¿Ya tienes cuenta?",

  "auth.forgotTitle": "Contraseña olvidada",
  "auth.forgotSubtitle": "Indica tu correo electrónico, te enviaremos un enlace para restablecerla.",
  "auth.sendResetLink": "Enviar enlace de restablecimiento",
  "auth.backToLogin": "← Volver al inicio de sesión",

  "auth.resetTitle": "Elige una nueva contraseña",
  "auth.newPassword": "Nueva contraseña",
  "auth.updatePassword": "Actualizar contraseña",

  "auth.checkEmailTitle": "Revisa tu correo",
  "auth.checkEmailSignup":
    "Te acabamos de enviar un enlace de confirmación. Haz clic en él para activar tu cuenta e iniciar sesión.",
  "auth.checkEmailReset":
    "Si existe una cuenta con esa dirección, te acabamos de enviar un enlace de restablecimiento.",

  "lang.choose": "Elegir idioma",
};

const ru: Dict = {
  "nav.catalogue": "Каталог",
  "nav.mode3d": "3D-режим",
  "nav.multiplayer": "Мультиплеер",
  "nav.createGame": "Создать игру",
  "nav.premium": "✨ Премиум",
  "nav.settings": "Настройки",
  "nav.logout": "Выйти",
  "nav.login": "Войти",
  "nav.signup": "Создать аккаунт",
  "nav.searchPlaceholder": "Поиск игры...",
  "common.by": "от",

  "footer.rights": "Сделано сообществом.",
  "footer.cgu": "Условия",
  "footer.privacy": "Конфиденциальность",
  "footer.report": "Пожаловаться",
  "footer.catalogue": "Каталог",

  "home.title": "Создавай, публикуй и играй в 2D мини-игры",
  "home.subtitle":
    "Pixolud — это платформа сообщества, где каждый может придумать мини-игру — платформер, головоломку, аркаду, лабиринт, викторину — опубликовать её и показать другим игрокам. Без единой строчки кода.",
  "home.ctaSignup": "Создать бесплатный аккаунт",
  "home.ctaCreateGame": "Создать игру",
  "home.ctaExplore": "Смотреть каталог",
  "home.searchPlaceholder": "Поиск игры, создателя...",
  "home.searchButton": "Искать",
  "home.statsGames": "опубликованных игр",
  "home.statsGame": "опубликованная игра",
  "home.statsMembers": "участников",
  "home.statsMember": "участник",
  "home.statsPlays": "сыгранных партий",
  "home.statsPlay": "сыгранная партия",
  "home.gameOfDay": "🎲 Игра дня",
  "home.featured": "👑 В центре внимания",
  "home.recent": "🆕 Недавно добавленные",
  "home.popular": "🔥 Популярные игры",
  "home.topRated": "⭐ Лучшие по оценке",
  "home.seeAll": "Смотреть все →",
  "home.emptyState": "Пока нет опубликованных игр — стань первым!",
  "home.bottomTitle": "Хочешь создать свою игру?",
  "home.bottomTextLoggedIn": "Перейди в редактор, чтобы создать и опубликовать свою следующую мини-игру.",
  "home.bottomTextLoggedOut":
    "Присоединяйся к сообществу и опубликуй свою первую мини-игру за несколько минут с помощью нашего простого редактора без кода.",
  "home.bottomButton": "Начать сейчас",

  "auth.loginTitle": "Войти",
  "auth.loginSubtitle": "Рады снова тебя видеть!",
  "auth.email": "Электронная почта",
  "auth.password": "Пароль",
  "auth.forgotPassword": "Забыли пароль?",
  "auth.loginButton": "Войти",
  "auth.noAccount": "Ещё нет аккаунта?",
  "auth.createAccount": "Создать аккаунт",

  "auth.signupTitle": "Создать аккаунт",
  "auth.signupSubtitle": "Присоединяйся к сообществу, чтобы создавать, публиковать и играть в мини-игры.",
  "auth.pseudo": "Псевдоним",
  "auth.pseudoPlaceholder": "Твой публичный псевдоним",
  "auth.passwordPlaceholder": "Минимум 8 символов",
  "auth.acceptCguPrefix": "Я прочитал(а) и принимаю",
  "auth.cguLink": "Условия использования",
  "auth.and": "и",
  "auth.privacyLink": "Политику конфиденциальности",
  "auth.signupButton": "Создать аккаунт",
  "auth.haveAccount": "Уже есть аккаунт?",

  "auth.forgotTitle": "Забыли пароль",
  "auth.forgotSubtitle": "Укажи свой email, мы отправим тебе ссылку для сброса пароля.",
  "auth.sendResetLink": "Отправить ссылку для сброса",
  "auth.backToLogin": "← Назад ко входу",

  "auth.resetTitle": "Выбери новый пароль",
  "auth.newPassword": "Новый пароль",
  "auth.updatePassword": "Обновить пароль",

  "auth.checkEmailTitle": "Проверь почту",
  "auth.checkEmailSignup":
    "Мы только что отправили тебе ссылку для подтверждения. Перейди по ней, чтобы активировать аккаунт и войти.",
  "auth.checkEmailReset":
    "Если аккаунт с таким адресом существует, мы только что отправили ссылку для сброса пароля.",

  "lang.choose": "Выбрать язык",
};

const ar: Dict = {
  "nav.catalogue": "الكتالوج",
  "nav.mode3d": "وضع ثلاثي الأبعاد",
  "nav.multiplayer": "متعدد اللاعبين",
  "nav.createGame": "إنشاء لعبة",
  "nav.premium": "✨ بريميوم",
  "nav.settings": "الإعدادات",
  "nav.logout": "تسجيل الخروج",
  "nav.login": "تسجيل الدخول",
  "nav.signup": "إنشاء حساب",
  "nav.searchPlaceholder": "ابحث عن لعبة...",
  "common.by": "بواسطة",

  "footer.rights": "صُنع بواسطة المجتمع.",
  "footer.cgu": "الشروط",
  "footer.privacy": "الخصوصية",
  "footer.report": "الإبلاغ عن محتوى",
  "footer.catalogue": "الكتالوج",

  "home.title": "أنشئ، انشر والعب ألعابًا مصغرة ثنائية الأبعاد",
  "home.subtitle":
    "Pixolud هي المنصة المجتمعية حيث يمكن لأي شخص تخيل لعبة مصغرة — منصات، ألغاز، أركيد، متاهة، اختبار — ونشرها ليكتشفها لاعبون آخرون. دون كتابة أي سطر برمجي.",
  "home.ctaSignup": "إنشاء حساب مجاني",
  "home.ctaCreateGame": "إنشاء لعبة",
  "home.ctaExplore": "استكشف الكتالوج",
  "home.searchPlaceholder": "ابحث عن لعبة أو منشئ...",
  "home.searchButton": "بحث",
  "home.statsGames": "لعبة منشورة",
  "home.statsGame": "لعبة منشورة",
  "home.statsMembers": "أعضاء",
  "home.statsMember": "عضو",
  "home.statsPlays": "جولة تم لعبها",
  "home.statsPlay": "جولة تم لعبها",
  "home.gameOfDay": "🎲 لعبة اليوم",
  "home.featured": "👑 مميزة",
  "home.recent": "🆕 أضيفت مؤخرًا",
  "home.popular": "🔥 الألعاب الشائعة",
  "home.topRated": "⭐ الأعلى تقييمًا",
  "home.seeAll": "عرض الكل ←",
  "home.emptyState": "لا توجد ألعاب منشورة بعد — كن أول من ينشئ واحدة!",
  "home.bottomTitle": "تريد إنشاء لعبتك الخاصة؟",
  "home.bottomTextLoggedIn": "توجّه إلى المحرر لإنشاء ونشر لعبتك المصغرة القادمة.",
  "home.bottomTextLoggedOut":
    "انضم إلى المجتمع وانشر أول لعبة مصغرة لك خلال دقائق باستخدام محررنا البسيط دون برمجة.",
  "home.bottomButton": "ابدأ الآن",

  "auth.loginTitle": "تسجيل الدخول",
  "auth.loginSubtitle": "سعداء بعودتك!",
  "auth.email": "البريد الإلكتروني",
  "auth.password": "كلمة المرور",
  "auth.forgotPassword": "هل نسيت كلمة المرور؟",
  "auth.loginButton": "تسجيل الدخول",
  "auth.noAccount": "ليس لديك حساب بعد؟",
  "auth.createAccount": "إنشاء حساب",

  "auth.signupTitle": "إنشاء حساب",
  "auth.signupSubtitle": "انضم إلى المجتمع لإنشاء ونشر ولعب الألعاب المصغرة.",
  "auth.pseudo": "الاسم المستعار",
  "auth.pseudoPlaceholder": "اسمك المستعار العام",
  "auth.passwordPlaceholder": "8 أحرف على الأقل",
  "auth.acceptCguPrefix": "لقد قرأت وأوافق على",
  "auth.cguLink": "شروط الاستخدام",
  "auth.and": "و",
  "auth.privacyLink": "سياسة الخصوصية",
  "auth.signupButton": "إنشاء حسابي",
  "auth.haveAccount": "لديك حساب بالفعل؟",

  "auth.forgotTitle": "نسيت كلمة المرور",
  "auth.forgotSubtitle": "أدخل بريدك الإلكتروني، وسنرسل لك رابط إعادة التعيين.",
  "auth.sendResetLink": "إرسال رابط إعادة التعيين",
  "auth.backToLogin": "→ العودة لتسجيل الدخول",

  "auth.resetTitle": "اختر كلمة مرور جديدة",
  "auth.newPassword": "كلمة المرور الجديدة",
  "auth.updatePassword": "تحديث كلمة المرور",

  "auth.checkEmailTitle": "تحقق من بريدك الإلكتروني",
  "auth.checkEmailSignup":
    "لقد أرسلنا لك للتو رابط تأكيد. انقر عليه لتفعيل حسابك وتسجيل الدخول.",
  "auth.checkEmailReset":
    "إذا كان هناك حساب مرتبط بهذا العنوان، فقد تم إرسال رابط إعادة التعيين إليك للتو.",

  "lang.choose": "اختر اللغة",
};

export const dictionaries: Record<Locale, Dict> = { fr, en, de, es, ru, ar };

export function translate(locale: Locale, key: string): string {
  return dictionaries[locale][key] ?? dictionaries.fr[key] ?? key;
}
