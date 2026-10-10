"use client";

import * as React from "react";
import { fetchEpisode } from "./api";
import { Episode } from "./episode";

/** Polls an episode every 1.5 s until it is ready or failed. Pass null to stop. */
export function useEpisode(id: string | null): { episode: Episode | null; error: string | null } {
  const [episode, setEpisode] = React.useState<Episode | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const ep = await fetchEpisode(id);
        if (!alive) return;
        setEpisode(ep);
        setError(null);
        if (ep.status.stage !== "ready" && ep.status.stage !== "failed") timer = setTimeout(tick, 1500);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Couldn't load the recording.");
        timer = setTimeout(tick, 3000);
      }
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  return { episode, error };
}
