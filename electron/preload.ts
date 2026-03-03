import { contextBridge, ipcRenderer } from 'electron';

// Exposes a safe, whitelisted API to the renderer process.
// contextIsolation: true and nodeIntegration: false are enforced in main.ts.
contextBridge.exposeInMainWorld('platform', {
  isAvailable: (): boolean =>
    ipcRenderer.sendSync('steam:isAvailable') as boolean,

  unlockAchievement: (id: string): Promise<void> =>
    ipcRenderer.invoke('steam:unlockAchievement', id),

  getAchievementUnlocked: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('steam:getAchievementUnlocked', id),

  submitScore: (board: string, score: number): Promise<void> =>
    ipcRenderer.invoke('steam:submitScore', board, score),

  fetchLeaderboard: (board: string, count: number) =>
    ipcRenderer.invoke('steam:fetchLeaderboard', board, count),

  cloudSave: (key: string, data: string): Promise<void> =>
    ipcRenderer.invoke('steam:cloudSave', key, data),

  cloudLoad: (key: string): Promise<string | null> =>
    ipcRenderer.invoke('steam:cloudLoad', key),

  openOverlay: (page?: string): void => {
    ipcRenderer.send('steam:openOverlay', page);
  },
});
