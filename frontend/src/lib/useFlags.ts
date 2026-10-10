"use client";

import * as React from "react";
import { FeatureFlags, fetchFlags } from "@/lib/api";

let cached: Promise<FeatureFlags> | null = null;

/** Feature switches from GET /config, fetched once per page load; null until known. */
export function useFlags(): FeatureFlags | null {
  const [flags, setFlags] = React.useState<FeatureFlags | null>(null);
  React.useEffect(() => {
    cached ??= fetchFlags();
    let live = true;
    cached.then((f) => live && setFlags(f));
    return () => {
      live = false;
    };
  }, []);
  return flags;
}
