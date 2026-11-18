// Renders public/icon.svg to the PNG sizes the PWA manifest and iOS need.
// Usage: npx tsx scripts/generate-icons.ts
import { readFileSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { ImageResponse } from "next/og";

async function main() {
  const svg = readFileSync("public/icon.svg");
  const src = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  for (const size of [180, 192, 512]) {
    const image = new ImageResponse(createElement("img", { src, width: size, height: size }), {
      width: size,
      height: size,
    });
    writeFileSync(`public/icon-${size}.png`, Buffer.from(await image.arrayBuffer()));
    console.log(`public/icon-${size}.png`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
