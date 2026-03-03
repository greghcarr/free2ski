import type { Configuration } from 'electron-builder';

const config: Configuration = {
  appId: 'com.yourname.skifree',
  productName: 'SkiFree',
  copyright: 'Copyright © 2025',
  directories: {
    buildResources: 'build-resources',
    output: 'dist/packages',
  },
  files: [
    'dist/electron/**/*',
    'dist/renderer/**/*',
    'package.json',
  ],
  extraResources: [
    // steamworks.js native bindings
    {
      from: 'node_modules/steamworks.js/dist',
      to: 'steamworks',
      filter: ['**/*.node', '*.dll', '*.so', '*.dylib'],
    },
  ],
  mac: {
    category: 'public.app-category.games',
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
    ],
    hardenedRuntime: true,
    // entitlements: 'build-resources/entitlements.mac.plist',
    // entitlementsInherit: 'build-resources/entitlements.mac.plist',
  },
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
    ],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
};

export default config;
