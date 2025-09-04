import { dropClientIdColumn } from "./drop-client-id-column";

// Simple runner script
dropClientIdColumn()
  .then(() => {
    console.log("✅ Column removal completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Column removal failed:", error);
    process.exit(1);
  });