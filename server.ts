// Reproduction: Bun CompressionStream forces buffering on streaming responses
// All compression formats (gzip, deflate, brotli, zstd) buffer until stream closes

const PORT = 3000;

// Create a stream that emits ~10KB chunks with delays to simulate streaming data
function createSlowStream() {
  let count = 0;
  return new ReadableStream({
    async pull(controller) {
      if (count >= 5) {
        controller.close();
        return;
      }
      // Simulate slow data generation
      await new Promise((resolve) => setTimeout(resolve, 500));
      count++;
      // Create ~10KB of data per chunk
      const header = `--- Chunk ${count} at ${new Date().toISOString()} ---\n`;
      const padding = "x".repeat(10 * 1024 - header.length) + "\n";
      const chunk = header + padding;
      console.log(`[Server] Sending chunk ${count}: ${chunk.length} bytes`);
      controller.enqueue(new TextEncoder().encode(chunk));
    },
  });
}

type Format = "none" | "gzip" | "deflate" | "brotli" | "zstd";

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") || "none") as Format;

    console.log(`\n[Server] Request for format: ${format}`);

    const stream = createSlowStream();

    // No compression - streams correctly
    if (format === "none") {
      return new Response(stream, {
        headers: { "Content-Type": "text/plain" },
      });
    }

    // gzip - streams correctly
    if (format === "gzip") {
      const compressed = stream.pipeThrough(new CompressionStream("gzip"));
      return new Response(compressed, {
        headers: {
          "Content-Type": "text/plain",
          "Content-Encoding": "gzip",
        },
      });
    }

    // deflate - streams correctly
    if (format === "deflate") {
      const compressed = stream.pipeThrough(new CompressionStream("deflate"));
      return new Response(compressed, {
        headers: {
          "Content-Type": "text/plain",
          "Content-Encoding": "deflate",
        },
      });
    }

    // brotli - BUFFERS instead of streaming (Bun extension)
    if (format === "brotli") {
      const compressed = stream.pipeThrough(
        new CompressionStream("brotli" as CompressionFormat)
      );
      return new Response(compressed, {
        headers: {
          "Content-Type": "text/plain",
          "Content-Encoding": "br",
        },
      });
    }

    // zstd - BUFFERS instead of streaming (Bun extension)
    if (format === "zstd") {
      const compressed = stream.pipeThrough(
        new CompressionStream("zstd" as CompressionFormat)
      );
      return new Response(compressed, {
        headers: {
          "Content-Type": "text/plain",
          "Content-Encoding": "zstd",
        },
      });
    }

    return new Response("Unknown format", { status: 400 });
  },
});

console.log(`Server running at http://localhost:${PORT}`);
console.log(`\nTest with curl (use -N to disable buffering):`);
console.log(`  curl -N "http://localhost:${PORT}?format=none"`);
console.log(`  curl -N "http://localhost:${PORT}?format=gzip" | gunzip`);
console.log(`  curl -N "http://localhost:${PORT}?format=brotli" | brotli -d`);
console.log(`  curl -N "http://localhost:${PORT}?format=zstd" | zstd -d`);
