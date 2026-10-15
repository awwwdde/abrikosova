import path from "node:path";
import { defineConfig } from "vitest/config";

// Алиас «@/» как в tsconfig: без него тест middleware (012a) не импортирует его
// зависимости. Остальное — настройки vitest по умолчанию
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
});
