const ADJECTIVES = [
  'arctic', 'bold', 'crisp', 'deep', 'frosty',
  'glacial', 'icy', 'keen', 'lone', 'misty',
  'nordic', 'polar', 'quick', 'rogue', 'sharp',
  'silent', 'swift', 'tall', 'wild', 'zinc',
];

const NOUNS = [
  'bear', 'birch', 'cedar', 'cliff', 'crow',
  'deer', 'eagle', 'elk', 'falcon', 'fox',
  'hawk', 'lynx', 'moose', 'otter', 'peak',
  'pine', 'raven', 'ridge', 'wolf', 'yak',
];

export function generateUsername(): string {
  const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
  const num  = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${adj}-${noun}-${num}`;
}
