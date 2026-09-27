import { defineConfig } from "@neondatabase/config/v1";

export default defineConfig({
  preview: {
    functions: {
      actcontrol: {
        name: "Agent Control Tower — control API",
        source: "functions/actcontrol/index.mjs",
      },
      actevents: {
        name: "Agent Control Tower — SSE event stream",
        source: "functions/actevents/index.mjs",
      },
    },
  },
  branch: () => ({
    preview: {
      functions: {
        actcontrol: { runtime: "nodejs24" },
        actevents: { runtime: "nodejs24" },
      },
    },
  }),
});
