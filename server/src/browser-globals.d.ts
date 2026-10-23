// The server shares the game's galaxy code (src/game/explore.ts) to check
// first-discovery claims against the seed. Type-checking follows its imports
// into game modules that mention a few browser globals, in code the Worker
// never runs; they're declared here only so those files type-check.

declare const localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
declare const location: { search: string };
