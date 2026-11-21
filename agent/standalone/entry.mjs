// Entry point of the single-file build (standalone/build.mjs). In a Node executable process.argv[0]
// is Node, process.argv[1] is the executable's own path, and the user's arguments start at index 2,
// the same as for bin/qrquick-print-agent.mjs. Checked on the built executable: `printers` must reach
// the printer command, not the "unknown command" message.
import { main } from '../src/cli.mjs';

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
