import EmailConfirmation from "@/components/EmailConfirmation";
import ResendEmailButton from "@/components/ResendEmailButton";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { resendConfirmationEmail } from "../actions";

export default async function VerifieTonEmailPage({ searchParams }: {
  searchParams: Promise<{ email?: string; resent?: string; resendError?: string }>;
}) {
  const { email, resent, resendError } = await searchParams;
  const locale = await getLocale();
  return <EmailConfirmation locale={locale} email={email} resent={resent === "1"} error={resendError}>
    {email && <form action={resendConfirmationEmail} className="email-resend"><input type="hidden" name="email" value={email}/><ResendEmailButton label={translate(locale, "auth.resendEmail")}/></form>}
  </EmailConfirmation>;
}
