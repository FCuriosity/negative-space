import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['packages/core/tests/**/*.test.ts','apps/desktop/tests/**/*.test.ts','apps/extension/tests/**/*.test.ts','apps/windows/tests/**/*.test.ts'] } });
