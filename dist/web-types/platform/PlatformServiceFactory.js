export async function createPlatformService() {
    if (__PLATFORM__ === 'electron' && __STEAM_ENABLED__) {
        const { SteamPlatformService } = await import('./SteamPlatformService');
        return new SteamPlatformService();
    }
    const { NullPlatformService } = await import('./NullPlatformService');
    return new NullPlatformService();
}
