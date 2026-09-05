"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PartyLobby({
  slug,
  code,
  pseudo,
}: {
  slug: string;
  code: string;
  pseudo: string | null;
}) {
  const [guestPseudo] = useState(
    () => `Invité${Math.floor(1000 + Math.random() * 9000)}`,
  );
  const myPseudo = pseudo ?? guestPseudo;
  const [members, setMembers] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`party-${slug}-${code}`);

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ pseudo: string }>();
        const names = Object.values(state).flatMap((entries) =>
          entries.map((e) => e.pseudo),
        );
        setMembers(Array.from(new Set(names)));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({ pseudo: myPseudo });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug, code, myPseudo]);

  const others = members.filter((m) => m !== myPseudo);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-full bg-violet-50 px-4 py-2 text-sm text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
      🎉 Mode Party (code {code}) ·{" "}
      {others.length > 0
        ? `Avec toi : ${others.join(", ")}`
        : "En attente qu'un ami rejoigne..."}
    </div>
  );
}
