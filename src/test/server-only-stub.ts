// Vitest runs in plain Node, not Next's webpack, so the real "server-only"
// package specifier (which Next aliases internally) doesn't resolve. This
// empty stub lets modules with `import "server-only"` be unit-tested directly.
export {};
