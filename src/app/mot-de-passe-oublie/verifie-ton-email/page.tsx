import EmailConfirmation from "@/components/EmailConfirmation";
import { getLocale } from "@/lib/i18n-server";
export default async function VerifieTonEmailPage() {
  return <EmailConfirmation locale={await getLocale()} reset />;
}
