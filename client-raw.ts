// client-raw.ts
import http from "node:http";

const BASE_URL = "http://localhost:3000";

function testRaw(format: string) {
  return new Promise<void>((resolve) => {
    const start = Date.now();
    let chunks = 0;
    let total = 0;

    const req = http.get(`${BASE_URL}?format=${format}`, (res) => {
      res.on("data", (buf) => {
        chunks++;
        total += buf.length;
        const ms = Date.now() - start;
        console.log(`[${ms}ms] ${format} chunk ${chunks}: ${buf.length} bytes`);
      });
      res.on("end", () => {
        const ms = Date.now() - start;
        console.log(
          `[done] ${format}: ${total} bytes in ${chunks} chunks over ${ms}ms\n`
        );
        resolve();
      });
    });

    req.on("error", (err) => {
      console.error(`${format} error`, err);
      resolve();
    });
  });
}

async function main() {
  console.log("Raw compressed stream probe (no auto-decompression)\n");
  await testRaw("none");
  await testRaw("gzip");
  await testRaw("deflate");
  await testRaw("brotli");
  await testRaw("zstd");
}

main();
