// Client to demonstrate the buffering issue at the raw byte level
// This shows when compressed bytes arrive, not decompressed output

const BASE_URL = "http://localhost:3000";

async function testRawBytes(format: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${format} (raw compressed bytes arrival times)`);
  console.log("=".repeat(60));

  const start = Date.now();

  try {
    const res = await fetch(`${BASE_URL}?format=${format}`);
    if (!res.ok || !res.body) {
      console.log(`Error: ${res.status}`);
      return;
    }

    const reader = res.body.getReader();
    let totalBytes = 0;
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunkCount++;
      totalBytes += value.length;
      const elapsed = Date.now() - start;
      console.log(
        `  [${elapsed.toString().padStart(5)}ms] Chunk ${chunkCount}: ${
          value.length
        } bytes`
      );
    }

    const total = Date.now() - start;
    console.log(
      `\n  Total: ${totalBytes} bytes in ${chunkCount} chunks over ${total}ms`
    );

    // Analysis
    if (chunkCount === 1 && format !== "none") {
      console.log(`  ⚠️  BUFFERED: All data arrived in a single chunk`);
    } else if (chunkCount >= 5) {
      console.log(`  ✓  STREAMING: Data arrived in multiple chunks`);
    }
  } catch (e) {
    console.log(`Error: ${e}`);
  }
}

async function main() {
  console.log("Bun CompressionStream Buffering Reproduction");
  console.log("Server sends 5 chunks, each ~500ms apart");
  console.log("We measure when raw bytes arrive at the client\n");

  await testRawBytes("none");
  await testRawBytes("gzip");
  await testRawBytes("deflate");
  await testRawBytes("brotli");
  await testRawBytes("zstd");
}

main();
