import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Les fichiers statiques (images, sons, modeles 3D) n'ont pas besoin de la
    // session : sans cette exclusion, chaque son d'un jeu faisait un appel a
    // Supabase.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ogg|mp3|wav|glb|gltf)$).*)",
  ],
};
