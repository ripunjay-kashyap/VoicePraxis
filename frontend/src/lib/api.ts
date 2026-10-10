import { Episode } from "./episode";
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
 * Checks if mock mode is requested either through query string or explicitly
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

/**
 * Upload video with XMLHttpRequest progress tracking (required for iOS Safari progress reporting).
 * Posts multipart to POST {API}/episodes
 */
export function uploadEpisode(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  const apiBase = getApiBase();

  // If no backend API URL is configured or mock mode is forced in capture
  if (!apiBase) {
    return new Promise((resolve) => {
      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += 20;
        if (onProgress) {
          onProgress({
            percent: Math.min(100, currentProgress),
            loaded: (file.size * Math.min(100, currentProgress)) / 100,
            total: file.size,
          });
        }
        if (currentProgress >= 100) {
          clearInterval(interval);
          resolve({ id: "mock" });
        }
      }, 200);
    });
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
        reject(
          new Error(`Upload failed with HTTP ${xhr.status}: ${xhr.statusText || xhr.responseText}`)
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during episode upload"));
    };

    xhr.ontimeout = () => {
      reject(new Error("Episode upload request timed out"));
    };

    const formData = new FormData();
    formData.append("file", file, file.name);

    xhr.send(formData);
  });
}

/**
 * Fetch episode details.
 * If mock is requested or id is 'mock', or backend is unreachable/unconfigured, returns MOCK_EPISODE.
 */
export async function fetchEpisode(
  id: string,
  forceMock = false
): Promise<Episode> {
  if (forceMock || id === "mock" || id === "ep_20261010_container_001") {
    return MOCK_EPISODE;
  }

  const apiBase = getApiBase();
  if (!apiBase) {
    console.warn("NEXT_PUBLIC_API_BASE not set. Returning mock episode.");
    return MOCK_EPISODE;
  }

  try {
    const res = await fetch(`${apiBase}/episodes/${id}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch episode: ${res.status} ${res.statusText}`);
    }

    const data: Episode = await res.json();
    return data;
  } catch (error) {
    console.warn("Error fetching real episode, falling back to mock:", error);
    return MOCK_EPISODE;
  }
}

/**
 * Returns playable video URL with range support.
 */
export function getVideoUrl(id: string, forceMock = false): string {
  if (forceMock || id === "mock" || id === "ep_20261010_container_001") {
    // If running with mock, can point to static sample video if present, or an empty placeholder
    return "/sample-video.mp4";
  }

  const apiBase = getApiBase();
  if (!apiBase) {
    return "/sample-video.mp4";
  }

  return `${apiBase}/episodes/${id}/video`;
}
