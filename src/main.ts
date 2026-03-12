import { createGame } from './game';
import { createPlatformService } from './platform/PlatformServiceFactory';
import { registerSW } from 'virtual:pwa-register';

async function main(): Promise<void> {
  const platform = await createPlatformService();
  const game = createGame(platform);

  // ResizeObserver fires whenever #game-container's dimensions change —
  // including when safe-area-inset CSS vars resolve on iPhone PWA and on
  // every orientation change. More reliable than window 'resize' alone.
  const refresh = (): void => { game.scale.refresh(); };
  const container = document.getElementById('game-container');
  if (container) {
    new ResizeObserver(refresh).observe(container);
  }
  window.addEventListener('resize', refresh);

  // Service-worker update prompt — shown as a DOM banner so it works
  // regardless of which Phaser scene is active. registerType:'prompt'
  // means the SW waits for us to call updateSW(true) before reloading,
  // so a player can finish their run before the page refreshes.
  const updateSW = registerSW({
    onNeedRefresh() {
      const banner = document.createElement('div');
      Object.assign(banner.style, {
        position:   'fixed',
        bottom:     '40px',
        left:       '50%',
        transform:  'translateX(-50%)',
        background: '#1a2a3a',
        color:      '#e8f0f8',
        padding:    '14px 32px',
        borderRadius: '8px',
        fontFamily: 'sans-serif',
        fontSize:   '15px',
        zIndex:     '99999',
        cursor:     'pointer',
        border:     '1px solid #4caf50',
        boxShadow:  '0 4px 20px rgba(0,0,0,0.6)',
        whiteSpace: 'nowrap',
      });
      banner.textContent = 'New version available — tap to update';
      banner.addEventListener('click', () => updateSW(true));
      document.body.appendChild(banner);
    },
    onOfflineReady() {},
  });
}

main().catch(console.error);
