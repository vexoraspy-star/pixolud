import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("verifyOtp failed:", error.message, error.status, error.code);
  }

  // Le modele d'e-mail par defaut de Supabase (jamais personnalise dans le
  // tableau de bord) pointe vers le serveur d'authentification de Supabase,
  // qui verifie le lien lui-meme PUIS redirige ici avec un "code" (PKCE) —
  // jamais avec token_hash/type. Sans ce second cas, le compte etait bel et
  // bien confirme cote Supabase mais cette page affichait quand meme
  // "lien invalide ou expire", sans jamais ouvrir de session.
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("exchangeCodeForSession failed:", error.message, error.status, error.code);
  }

  return NextResponse.redirect(
    `${origin}/connexion?error=${encodeURIComponent(
      "Le lien de confirmation est invalide ou a expiré.",
    )}`,
  );
}
