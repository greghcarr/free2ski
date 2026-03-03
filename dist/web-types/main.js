import { createGame } from './game';
import { createPlatformService } from './platform/PlatformServiceFactory';
async function main() {
    const platform = await createPlatformService();
    createGame(platform);
}
main().catch(console.error);
