/** Standalone seed runner: `pnpm db:seed`. */
import { seedIfEmpty } from "./seed";

seedIfEmpty()
  .then(() => {
    console.log("[seed] complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[seed] failed:", error);
    process.exit(1);
  });
