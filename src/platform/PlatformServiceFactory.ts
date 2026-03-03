import type { IPlatformService } from './IPlatformService';

declare const __PLATFORM__: string;
declare const __STEAM_ENABLED__: boolean;

export async function createPlatformService(): Promise<IPlatformService> {
  if (__PLATFORM__ === 'electron' && __STEAM_ENABLED__) {
    const { SteamPlatformService } = await import('./SteamPlatformService');
    return new SteamPlatformService();
  }
  const { NullPlatformService } = await import('./NullPlatformService');
  return new NullPlatformService();
}
