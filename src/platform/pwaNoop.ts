// Stub for virtual:pwa-register in Electron builds — service workers
// are not used in the packaged desktop app.
export function registerSW(_options?: {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
