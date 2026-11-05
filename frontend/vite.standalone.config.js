import { readFileSync, writeFileSync } from "fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";

const OUT_HTML = resolve(__dirname, "dist-standalone", "training-standalone.html");

// Vite always places the entry script in <head> with type="module", relying on modules'
// built-in auto-defer (they run after the DOM is parsed, wherever they sit) - but that script
// is now a plain IIFE, not a module (see output.format below), so it loses that auto-defer
// once the module type is stripped. A plain inline <script> runs immediately at parse time
// (the `defer` attribute has no effect on inline scripts, only on ones with `src=`), which
// means it would run before <body>'s <div id="root"> exists, so the mount silently fails and
// the page stays blank. Fix: move the script itself from <head> to just after <div id="root">
// in <body>, which gives correct timing without needing module semantics at all.
function moveInlineScriptAfterRoot() {
  return {
    name: "move-inline-script-after-root",
    apply: "build",
    writeBundle() {
      let html = readFileSync(OUT_HTML, "utf-8");
      const match = html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/);
      if (!match) throw new Error("expected entry <script type=\"module\"> not found in build output");
      html = html.replace(match[0], "");
      html = html.replace("</body>", `<script>${match[1]}</script>\n  </body>`);
      writeFileSync(OUT_HTML, html);
    },
  };
}

// Separate build config for the Streamlit-embeddable single-file version of the training
// module (training-standalone.html / src/standalone-main.jsx). Kept apart from the main
// vite.config.js so the normal `npm run build` output is unaffected - this one inlines every
// script and stylesheet into one HTML file with no external asset requests, since the result
// gets embedded via Streamlit's components.html(), not served from a real web server.
export default defineConfig({
  plugins: [react(), viteSingleFile(), moveInlineScriptAfterRoot()],
  build: {
    outDir: resolve(__dirname, "dist-standalone"),
    rollupOptions: {
      input: resolve(__dirname, "training-standalone.html"),
      output: {
        // Plain IIFE, not type="module" - ES module scripts can silently fail to execute
        // inside Streamlit's sandboxed components.html() iframe (opaque srcdoc origin breaks
        // module resolution even with zero external imports), which otherwise renders a
        // blank page with no console error surfaced through Streamlit.
        format: "iife",
      },
    },
  },
});
