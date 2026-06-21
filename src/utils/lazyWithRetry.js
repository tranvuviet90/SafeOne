import { lazy } from "react";

/**
 * A wrapper around React.lazy that catches import failures (chunk load errors)
 * and automatically triggers a page reload to pull the latest version from the server.
 * Uses a time-based threshold to prevent infinite reload loops in case of persistent offline state.
 */
export function lazyWithRetry(componentImport) {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.error("Lazy load failure:", error);
      
      const errorMessage = error?.message || "";
      const isChunkLoadFailed =
        errorMessage.includes("Failed to fetch dynamically imported module") ||
        errorMessage.includes("Failed to load module script") ||
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("MIME type");

      if (isChunkLoadFailed) {
        const lastReload = localStorage.getItem("last-chunk-failure-reload");
        const now = Date.now();
        
        // Prevent infinite reload loop by checking if we reloaded in the last 10 seconds
        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          localStorage.setItem("last-chunk-failure-reload", String(now));
          console.warn("New version detected or chunk load failed. Reloading page...");
          window.location.reload();
          // Return a pending promise to prevent rendering anything before reload
          return new Promise(() => {});
        }
      }
      throw error;
    }
  });
}
