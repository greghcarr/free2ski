import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import {
  initSteam,
  isSteamAvailable,
  unlockAchievement,
  submitLeaderboardScore,
  fetchLeaderboard,
} from './steamBridge';

// Replace with your real Steam App ID when you have one.
// 480 is the Spacewar test app (always works for development).
const STEAM_APP_ID = 480;

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 450,
    title: 'SkiFree',
    backgroundColor: '#1a2a3a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // SECURITY: keep enabled
      nodeIntegration: false,   // SECURITY: keep disabled
      sandbox: false,           // Required for contextBridge + preload
    },
  });

  // In development, load from the Vite dev server.
  // In production, load the built renderer.
  const rendererDist = path.join(__dirname, '..', 'renderer', 'index.html');
  mainWindow.loadFile(rendererDist);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- IPC Handlers ---

ipcMain.on('steam:isAvailable', (event) => {
  event.returnValue = isSteamAvailable();
});

ipcMain.handle('steam:unlockAchievement', async (_event, id: string) => {
  if (!isSteamAvailable()) return;
  unlockAchievement(id);
});

ipcMain.handle('steam:getAchievementUnlocked', async (_event, _id: string): Promise<boolean> => {
  // TODO: implement getSteamClient().achievement.isActivated(id)
  return false;
});

ipcMain.handle('steam:submitScore', async (_event, board: string, score: number) => {
  await submitLeaderboardScore(board, score);
});

ipcMain.handle('steam:fetchLeaderboard', async (_event, board: string, count: number) => {
  return fetchLeaderboard(board, count);
});

ipcMain.handle('steam:cloudSave', async (_event, _key: string, _data: string) => {
  // TODO: implement Steam Cloud via steamClient
});

ipcMain.handle('steam:cloudLoad', async (_event, _key: string): Promise<string | null> => {
  // TODO: implement Steam Cloud via steamClient
  return null;
});

ipcMain.on('steam:openOverlay', (_event, _page?: string) => {
  // TODO: getSteamClient()?.overlay.activateGameOverlay(page ?? 'achievements')
});

// --- App lifecycle ---

app.whenReady().then(() => {
  initSteam(STEAM_APP_ID);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
