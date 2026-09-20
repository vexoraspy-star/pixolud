import Link from "next/link";
import AuthCard from "./AuthCard";
import { translate, type Locale } from "@/lib/i18n";

const copy: Record<Locale, { help: string; home: string; step: string }> = {
  fr: { help: "Pas de mail ? Regarde aussi dans les courriers indésirables. Si tu demandes un nouveau lien, utilise le plus récent.", home: "Retour à l’accueil", step: "ON Y EST PRESQUE" },
  en: { help: "No email? Check your spam folder too. If you request another link, use the most recent one.", home: "Back to home", step: "ALMOST THERE" },
  de: { help: "Keine E-Mail? Prüfe auch deinen Spam-Ordner. Wenn du einen neuen Link anforderst, verwende den neuesten.", home: "Zur Startseite", step: "FAST GESCHAFFT" },
  es: { help: "¿No recibiste el correo? Revisa también el spam. Si solicitas otro enlace, utiliza el más reciente.", home: "Volver al inicio", step: "YA CASI ESTÁ" },
  ru: { help: "Нет письма? Проверь папку «Спам». Если запросишь новую ссылку, используй самую последнюю.", home: "На главную", step: "ПОЧТИ ГОТОВО" },
  ar: { help: "لم تصلك الرسالة؟ تحقّق من البريد غير المرغوب فيه أيضًا. إذا طلبت رابطًا جديدًا، فاستخدم الأحدث.", home: "العودة إلى الرئيسية", step: "أوشكت على الانتهاء" },
};

export default function EmailConfirmation({ locale, reset = false, email, resent, error, children }: {
  locale: Locale; reset?: boolean; email?: string; resent?: boolean; error?: string; children?: React.ReactNode;
}) {
  const t = (key: string) => translate(locale, key);
  return <AuthCard><div className="email-confirmation">
    <div className="email-art" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><rect x="5" y="11" width="38" height="29" rx="7" stroke="currentColor" strokeWidth="2"/><path d="m7 15 17 13 17-13" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="38" cy="10" r="9" fill="currentColor"/><path d="m34 10 3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
    <p className="utility-kicker">{copy[locale].step}</p>
    <h1>{t("auth.checkEmailTitle")}</h1>
    <p className="email-explanation">{t(reset ? "auth.checkEmailReset" : "auth.checkEmailSignup")}</p>
    {email && <strong className="email-address">{email}</strong>}
    {error ? <p role="alert" className="email-notice is-error">{error}</p> : resent && <p role="status" className="email-notice">✓ {t("auth.resendEmailSent")}</p>}
    <p className="email-help">{copy[locale].help}</p>
    {children}
    <nav className="email-links"><Link href="/connexion">{t("auth.backToLogin")}</Link><Link href="/">{copy[locale].home}</Link></nav>
  </div></AuthCard>;
}
