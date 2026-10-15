/**
 * Сервер Firefox для qa.mjs в контейнере Playwright (011g) — для Windows-машин,
 * где Firefox из Playwright не стартует.
 *
 * Внутри контейнера localhost — сам контейнер, а админка ходит на localhost:3000
 * (next) и localhost:<API_HOST_PORT> (API; другой порт — через -e QA_PORTS=3000,8002). Пробрасываем эти порты на машину-хозяина, чтобы
 * адреса и cookie были те же, что в обычном браузере, и запускаем run-server.
 *
 *   docker run --rm -d -p 3100:3100 --name admin-qa-firefox \
 *     -v "$PWD:/qa" mcr.microsoft.com/playwright:v1.56.1-noble node /qa/firefox-server.mjs
 *   QA_FIREFOX_WS=ws://127.0.0.1:3100/ npm run qa
 * В Git Bash перед docker run — `export MSYS_NO_PATHCONV=1`, иначе /qa/… станет
 * путём Windows. Адрес — 127.0.0.1, не localhost: localhost может уйти в IPv6.
 * (`connect({ exposeNetwork })` из Playwright с Firefox не открывал страницы.)
 */

import { spawn } from "node:child_process";
import net from "node:net";

const HOST = process.env.QA_HOST ?? "host.docker.internal";

// Порт API для браузера — API_HOST_PORT из docker-compose (по умолчанию 8000, если
// занят — другой); лишний проброс ничего не ломает
const PORTS = (process.env.QA_PORTS ?? "3000,8000,8001").split(",").map(Number);

for (const port of PORTS) {
  net
    .createServer((client) => {
      const upstream = net.connect(port, HOST);
      client.pipe(upstream).pipe(client);
      const close = () => {
        client.destroy();
        upstream.destroy();
      };
      client.on("error", close);
      upstream.on("error", close);
    })
    .listen(port, "127.0.0.1");
}

spawn("npx", ["-y", "playwright@1.56.1", "run-server", "--port", "3100", "--host", "0.0.0.0"], {
  stdio: "inherit",
});
