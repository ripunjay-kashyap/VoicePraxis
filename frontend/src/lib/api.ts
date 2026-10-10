import { Episode, ProcessingStage } from "./episode";
import { MOCK_EPISODE } from "./mock-episode";

/**
 * Normalized API Base URL from NEXT_PUBLIC_API_BASE
 */
export function getApiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base || base.trim() === "") {
    return "";
  }
  return base.trim().replace(/\/+$/, "");
}

/**
 * Checks if mock mode is explicitly requested through query string (?mock=1)
 */
export function isMockMode(queryParam?: string | null): boolean {
  if (queryParam !== undefined && queryParam !== null) {
    return queryParam === "1" || queryParam.toLowerCase() === "true";
  }
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    return params.get("mock") === "1" || params.get("mock")?.toLowerCase() === "true";
  }
  return false;
}

export interface UploadProgress {
  percent: number;
  loaded: number;
  total: number;
}

export interface UploadResult {
  id: string;
}

export interface SavedEpisodeListItem {
  id: string;
  status: string;
  created_at: number;
  saved: boolean;
  label: string;
  task: string;
  duration: number;
}

export interface PatchChange {
  target: "task" | string;
  field: string;
  value: unknown;
}

/**
 * Fetch saved episodes list: GET /episodes?saved=true
 */
export async function fetchSavedEpisodes(): Promise<SavedEpisodeListItem[]> {
  const apiBase = getApiBase();
  if (!apiBase) return [];

  try {
    const res = await fetch(`${apiBase}/episodes?saved=true`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const list: SavedEpisodeListItem[] = await res.json();
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn("Failed to fetch saved episodes:", err);
    return [];
  }
}

/**
 * Upload video with XMLHttpRequest progress tracking.
 * Strictly checks backend URL and parses { detail: "..." } errors.
 */
export function uploadEpisode(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  templateId?: string | null,
  purpose?: "reference" | "take"
): Promise<UploadResult> {
  const apiBase = getApiBase();

  if (!apiBase) {
    return Promise.reject(
      new Error("Backend URL not configured. Please set NEXT_PUBLIC_API_BASE in environment variables.")
    );
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${apiBase}/episodes`;

    xhr.open("POST", url, true);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress({
            percent,
            loaded: event.loaded,
            total: event.total,
          });
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          const episodeId = data.id || data.episode_id;
          if (!episodeId) {
            reject(new Error("Response missing episode ID"));
            return;
          }
          resolve({ id: episodeId });
        } catch (err) {
          reject(new Error(`Failed to parse response: ${err}`));
        }
      } else {
        let errorDetail = `Upload failed (${xhr.status})`;
        try {
          const errData = JSON.parse(xhr.responseText);
          if (errData.detail) {
            errorDetail = errData.detail;
          }
        } catch {
          // keep fallback
        }
        reject(new Error(errorDetail));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed: check the connection and try again"));
    };

    xhr.ontimeout = () => {
      reject(new Error("Upload timed out: check the connection and try again"));
    };

    const formData = new FormData();
    formData.append("file", file, file.name);
    if (templateId) formData.append("template_id", templateId);
    if (purpose) formData.append("purpose", purpose);

    xhr.send(formData);
  });
}

/**
 * Fetch episode details.
 * Rule 6: No fake data. Mock is only used if forceMock (?mock=1) is explicitly set.
 * Otherwise, always calls GET /episodes/{id} on live API and throws clear errors.
 */
export async function fetchEpisode(
  id: string,
  forceMock = false
): Promise<Episode> {
  if (forceMock || id === "mock") {
    return {
      ...MOCK_EPISODE,
      episode_id: "mock-container",
      label: "Mock Reference Container Task",
    };
  }

  const apiBase = getApiBase();
  if (!apiBase) {
    throw new Error(
      "Backend URL not configured. Set NEXT_PUBLIC_API_BASE or append ?mock=1 to view mock data."
    );
  }

  const res = await fetch(`${apiBase}/episodes/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    let errorMsg = `Episode fetch failed with HTTP ${res.status}`;
    try {
      const errData = await res.json();
      if (errData.detail) errorMsg = errData.detail;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errorMsg);
  }

  const data = await res.json();

  // If episode ready: unpack { id, status, stage, saved, label, episode: { ... } }
  if (data.episode) {
    return {
      ...data.episode,
      saved: data.saved,
      label: data.label,
      video_only: data.video_only ?? null,
      status: {
        stage: (data.stage || data.status || "ready") as ProcessingStage,
        error: data.error || null,
      },
    };
  }

  // If episode is still processing or failed: return state without inventing fake pipeline (P0.2)
  if (data.stage || data.status) {
    const currentStage = (data.stage || data.status) as ProcessingStage;
    return {
      schema_version: "0.2",
      episode_id: data.id || id,
      media_ref: "episode.mp4",
      duration_seconds: data.duration || 0,
      saved: data.saved,
      label: data.label,
      status: {
        stage: currentStage,
        error: data.error || null,
      },
      pipeline: null, // No fake pipeline invented!
      scene: "",
      task: {
        name: "",
        declared_intent: null,
        outcome: "unresolved",
        outcome_evidence: "",
      },
      narration: [],
      actions: [],
      pending_questions: [],
      clarifications: [],
      template_check: null,
      video_only: null,
      human_corrections: [],
    };
  }

  return data as Episode;
}

/**
 * Returns playable video URL with range support.
 */
export function getVideoUrl(id: string, forceMock = false): string {
  if (forceMock || id === "mock") {
    return "/sample-video.mp4";
  }

  const apiBase = getApiBase();
  if (!apiBase) {
    return "/sample-video.mp4";
  }

  return `${apiBase}/episodes/${id}/video`;
}

/**
 * Patch episode changes using real contract:
 * PATCH /episodes/{id}
 * Body: { changes: [{ target: "action-01", field: "...", value: ... }] }
 * Returns full updated episode from server (P0.1).
 */
export async function patchEpisodeChanges(
  episodeId: string,
  changes: PatchChange[]
): Promise<{ success: boolean; episode?: Episode; detail?: string }> {
  const apiBase = getApiBase();
  if (!apiBase) {
    return { success: false, detail: "Backend URL not configured." };
  }

  try {
    const res = await fetch(`${apiBase}/episodes/${episodeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        success: false,
        detail: data?.detail || `Save failed with HTTP ${res.status}`,
      };
    }

    if (data?.episode) {
      return {
        success: true,
        episode: {
          ...data.episode,
          saved: data.saved,
          label: data.label,
          video_only: data.video_only ?? null,
          status: {
            stage: (data.stage || data.status || "ready") as ProcessingStage,
            error: data.error || null,
          },
        },
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error during save";
    return { success: false, detail: message };
  }
}

/**
 * Reset human corrections on a saved episode:
 * POST /episodes/{id}/reset
 * Returns full reset episode (P0.3).
 */
export async function resetSavedEpisode(
  episodeId: string
): Promise<{ success: boolean; episode?: Episode; detail?: string }> {
  const apiBase = getApiBase();
  if (!apiBase) {
    return { success: false, detail: "Backend URL not configured." };
  }

  try {
    const res = await fetch(`${apiBase}/episodes/${episodeId}/reset`, {
      method: "POST",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        success: false,
        detail: data?.detail || `Reset failed with HTTP ${res.status}`,
      };
    }

    if (data?.episode) {
      return {
        success: true,
        episode: {
          ...data.episode,
          saved: data.saved,
          label: data.label,
          video_only: data.video_only ?? null,
          status: {
            stage: (data.stage || data.status || "ready") as ProcessingStage,
            error: data.error || null,
          },
        },
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error during reset";
    return { success: false, detail: message };
  }
}

/**
 * Get server export URL:
 * GET /episodes/{id}/export?format=json
 * GET /episodes/{id}/export?format=zip
 */
export function getExportUrl(episodeId: string, format: "json" | "zip"): string {
  const apiBase = getApiBase();
  return `${apiBase}/episodes/${episodeId}/export?format=${format}`;
}

export interface FeatureFlags {
  SIDE_BY_SIDE: boolean;
  COPILOT: boolean;
  REVIEW_QUEUE: boolean;
  [key: string]: boolean;
}

const NO_FLAGS: FeatureFlags = { SIDE_BY_SIDE: false, COPILOT: false, REVIEW_QUEUE: false };

/** Feature switches from GET /config. Any failure → everything off (mvp-v1 behaviour). */
export async function fetchFlags(): Promise<FeatureFlags> {
  const apiBase = getApiBase();
  if (!apiBase) return NO_FLAGS;
  try {
    const res = await fetch(`${apiBase}/config`, { cache: "no-store" });
    if (!res.ok) return NO_FLAGS;
    const data = await res.json();
    return { ...NO_FLAGS, ...(data.flags || {}) };
  } catch {
    return NO_FLAGS;
  }
}

// ---- TEMPLATES (feature) ----
export interface TemplateSummary {
  id: string;
  name: string;
  task: string | null;
  steps: number;
  created_at: number;
  source_episode_id: string;
}

export async function fetchTemplates(): Promise<TemplateSummary[]> {
  const apiBase = getApiBase();
  if (!apiBase) return [];
  try {
    const res = await fetch(`${apiBase}/templates`, { cache: "no-store" });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

async function postJson(path: string, body: unknown): Promise<{ ok: boolean; data?: Record<string, unknown> & { name?: string; episode?: Episode; saved?: boolean; label?: string; video_only?: Episode | null; stage?: string; error?: string | null }; detail?: string }> {
  const apiBase = getApiBase();
  if (!apiBase) return { ok: false, detail: "Backend URL not configured." };
  try {
    const res = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data } : { ok: false, detail: data.detail || `Request failed (${res.status})` };
  } catch {
    return { ok: false, detail: "Network error. Check the connection and try again." };
  }
}

export interface TemplateStep {
  id?: string;
  instruction: string;
  verb?: string | null;
  object?: string | null;
  reference_reason?: string | null;
  required: boolean;
}

export interface TemplateDetail {
  id: string;
  name: string;
  task: string | null;
  source_episode_id: string;
  created_at: number;
  steps: TemplateStep[];
}

export async function createTemplate(episodeId: string, name: string, steps?: TemplateStep[]) {
  return postJson("/templates", { episode_id: episodeId, name, ...(steps ? { steps } : {}) });
}

export async function fetchTemplate(id: string): Promise<TemplateDetail | null> {
  const apiBase = getApiBase();
  if (!apiBase) return null;
  try {
    const res = await fetch(`${apiBase}/templates/${id}`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const apiBase = getApiBase();
  if (!apiBase) return false;
  try {
    const res = await fetch(`${apiBase}/templates/${id}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Run a template check on an existing episode; returns the updated episode on success. */
export async function checkEpisode(episodeId: string, templateId: string): Promise<{ ok: boolean; episode?: Episode; detail?: string }> {
  const r = await postJson(`/episodes/${episodeId}/check`, { template_id: templateId });
  if (!r.ok || !r.data?.episode) return { ok: false, detail: r.detail };
  return {
    ok: true,
    episode: {
      ...r.data.episode,
      saved: r.data.saved,
      label: r.data.label,
      video_only: r.data.video_only ?? null,
      status: { stage: (r.data.stage || "ready") as ProcessingStage, error: r.data.error || null },
    },
  };
}
