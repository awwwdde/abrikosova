import { request } from "@playwright/test";
import { existsSync, unlinkSync } from "node:fs";
import { apiURL, base, cleanup, environment, resetLimits, root, run } from "./support.js";
export default async function teardown(): Promise<void> {
  try {
    cleanup();
    const result = environment("verify", { prefix: "SMOKE Тест " });
    console.log(`CLEAN_DB=${result}`);
    const counts = JSON.parse(result) as Record<string, number>;
    if (Object.values(counts).some((value) => value !== 0))
      throw new Error("В БД остались строки SMOKE");
  } finally {
    for (let index = 0; index < 2; index++) {
      const state = `${root}/.auth/${run().id}-${index}.json`;
      if (existsSync(state)) {
        const api = await request.newContext({
          storageState: state,
          extraHTTPHeaders: { Origin: base },
        });
        try {
          await api.post(`${apiURL}/auth/logout`);
        } finally {
          await api.dispose();
        }
        unlinkSync(state);
      }
      const token = `${root}/.auth/${run().id}-${index}-access.json`;
      if (existsSync(token)) unlinkSync(token);
    }
    resetLimits();
  }
}
