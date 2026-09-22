import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  preview: {
    functions: {
      actcontrol: {
        name: "Agent Control Tower — control API",
        source: "functions/actcontrol/index.mjs",
        env: { CONTROL_API_KEY: process.env.CONTROL_API_KEY! },
      },
      actevents: {
        name: "Agent Control Tower — SSE event stream",
        source: "functions/actevents/index.mjs",
        env: { CONTROL_API_KEY: process.env.CONTROL_API_KEY! },
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
