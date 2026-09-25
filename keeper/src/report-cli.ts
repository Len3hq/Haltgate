import { config } from "./config";
import { buildReport, formatReport } from "./report";
import { Store } from "./store";

// Prints the lead-time table from a local DATA_DIR. For the Railway instance,
// open <service-url>/report?format=text instead.
const rows = buildReport(await new Store(config.dataDir).readEvents());
console.log(process.argv.includes("--json") ? JSON.stringify(rows, null, 2) : formatReport(rows));
