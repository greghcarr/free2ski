import { createGame } from './game';
import { createPlatformService } from './platform/PlatformServiceFactory';

async function main(): Promise<void> {
  const platform = await createPlatformService();
  createGame(platform);
}

main().catch(console.error);
