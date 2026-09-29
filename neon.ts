import { defineConfig } from "@neondatabase/config/v1";

export default defineConfig({
  preview: {
    functions: {
      actctlp3: {
        name: "Agent Control Tower — control API",
        source: "functions/actcontrol/index.mjs",
      },
      actevtp3: {
        name: "Agent Control Tower — SSE event stream",
        source: "functions/actevents/index.mjs",
      },
    },
  },
  branch: () => ({
    preview: {
      functions: {
        actctlp3: { runtime: "nodejs24" },
        actevtp3: { runtime: "nodejs24" },
      },
    },
  }),
});
