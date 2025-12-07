// Reproduction: Bun CompressionStream forces buffering on streaming responses
// All compression formats (gzip, deflate, brotli, zstd) buffer until stream closes

const PORT = 3000;

// Stream the bun.png file (~150KB) in chunks with delays to simulate streaming data
async function createSlowStream() {
  const file = Bun.file("./bun.png");
  const data = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 10 * 1024; // 10KB chunks
  let offset = 0;

  return new ReadableStream({
    async pull(controller) {
      if (offset >= data.length) {
        controller.close();
        return;
      }
      // Simulate slow data generation
      await new Promise((resolve) => setTimeout(resolve, 500));
      const end = Math.min(offset + chunkSize, data.length);
      const chunk = data.slice(offset, end);
      const chunkNum = Math.floor(offset / chunkSize) + 1;
      console.log(`[Server] Sending chunk ${chunkNum}: ${chunk.length} bytes (offset ${offset}-${end})`);
      controller.enqueue(chunk);
      offset = end;
    },
  });
}

type Format = "none" | "gzip" | "deflate" | "brotli" | "zstd";

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") || "none") as Format;

    console.log(`\n[Server] Request for format: ${format}`);

    const stream = await createSlowStream();

    // No compression - streams correctly
    if (format === "none") {
      return new Response(stream, {
        headers: { "Content-Type": "image/png" },
      });
    }

    // gzip - streams correctly
    if (format === "gzip") {
      const compressed = stream.pipeThrough(new CompressionStream("gzip"));
      return new Response(compressed, {
        headers: {
          "Content-Type": "image/png",
          "Content-Encoding": "gzip",
        },
      });
    }

    // deflate - streams correctly
    if (format === "deflate") {
      const compressed = stream.pipeThrough(new CompressionStream("deflate"));
      return new Response(compressed, {
        headers: {
          "Content-Type": "image/png",
          "Content-Encoding": "deflate",
        },
      });
    }

    // brotli - BUFFERS instead of streaming (Bun extension)
    if (format === "brotli") {
      const compressed = stream.pipeThrough(
        new CompressionStream("brotli" as "gzip")
      );
      return new Response(compressed, {
        headers: {
          "Content-Type": "image/png",
          "Content-Encoding": "br",
        },
      });
    }

    // zstd - BUFFERS instead of streaming (Bun extension)
    if (format === "zstd") {
      const compressed = stream.pipeThrough(
        new CompressionStream("zstd" as "gzip")
      );
      return new Response(compressed, {
        headers: {
          "Content-Type": "image/png",
          "Content-Encoding": "zstd",
        },
      });
    }

    return new Response("Unknown format", { status: 400 });
  },
});

console.log(`Server running at http://localhost:${PORT}`);
console.log(`\nTest with curl (use -N to disable buffering, -o to save PNG):`);
console.log(`  curl -N "http://localhost:${PORT}?format=none" -o out.png`);
console.log(`  curl -N "http://localhost:${PORT}?format=gzip" | gunzip > out.png`);
console.log(`  curl -N "http://localhost:${PORT}?format=brotli" | brotli -d > out.png`);
console.log(`  curl -N "http://localhost:${PORT}?format=zstd" | zstd -d > out.png`);
