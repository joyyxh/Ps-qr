# QRquick print agent

The print agent runs on the computer that is connected to the shop's printer. It asks
QRquick for approved, paid orders, downloads each file through a short-lived link, checks
the chosen printer can do the job, and prints it. It has no dependencies: it needs
**Node.js 18.17 or newer** and nothing else from npm.

> **Status: not yet tested on a real printer.** The unit tests use fake printers and a fake
> server. Before you rely on it, run the hardware checklist at the end of this file.

## What it does and does not do

- Prints only orders the owner has approved **and** marked as paid. The database enforces this.
- Never prints the same job twice on its own. If the agent cannot tell whether a page came out
  (for example, the computer lost power while printing), the owner sees **"Check the printer"**
  and decides whether to print again.
- Makes no inbound connections. It only calls the QRquick print-agent API over HTTPS.
- Stores its token in a private file on this computer (`agent.json`). The token is never printed.

## Windows

1. Install **Node.js LTS** (from nodejs.org). Use the default install.
2. Install **SumatraPDF** (from sumatrapdfreader.org). Use the normal installer, not the
   portable version. The agent looks in `C:\Program Files\SumatraPDF\` and `%LOCALAPPDATA%\SumatraPDF\`.
3. Copy this `agent` folder to a fixed place, for example `C:\QRquick\agent`.
4. Open PowerShell in that folder and run the commands below.

## Linux (Ubuntu or Debian)

1. Install CUPS and Node.js 18+: `sudo apt install cups nodejs`.
2. Add the printer in the CUPS web page (`http://localhost:631`), or with `lpadmin`.
   Make sure it prints a test page from CUPS first.
3. Copy this `agent` folder to e.g. `~/qrquick/agent` and run the commands below.

## Setup (both platforms)

Get the pairing code from the owner app: **Orders → Printing computers → Connect a printing
computer**. The code is valid for 10 minutes and works once.

```
node bin/qrquick-print-agent.mjs pair https://<project-ref>.supabase.co/functions/v1/print-agent XXXX-XXXX
node bin/qrquick-print-agent.mjs printers
node bin/qrquick-print-agent.mjs set-printer "Office Printer"
node bin/qrquick-print-agent.mjs doctor
node bin/qrquick-print-agent.mjs test-print
node bin/qrquick-print-agent.mjs run
```

(On Windows, use backslashes if you prefer: `bin\qrquick-print-agent.mjs`.)

- `pair` — connects this computer to the shop. Run once per computer.
- `printers` — lists the printers this computer can see, with the colour, duplex and
  on/off state the agent could read.
- `set-printer` — the fallback printer. The owner app can pick a different printer for this
  computer; that choice wins.
- `doctor` — checks the printing software, the printers and the connection to QRquick.
- `test-print` — prints **one** test page on the chosen printer. This uses paper.
- `run` — keeps printing approved orders. Leave it running. Ctrl+C stops it safely.

The agent works on A4 paper only, because the order does not yet record a paper size.
A printer with no A4 option will refuse every order, and the owner sees why.

### Start automatically and keep it running

After `pair` and `set-printer`, run this once on the shop computer:

```
node bin/qrquick-print-agent.mjs autostart
```

It writes a file into the `autostart` folder next to the agent and prints the install commands:

- **Windows:** a Task Scheduler task (`QRquick-print-agent.xml`) that starts `run` when you sign in,
  and restarts it one minute after it stops. Install it with the `schtasks` command the tool prints.
- **Linux:** a systemd user service (`qrquick-print-agent.service`) that starts `run` and restarts it
  after 10 seconds if it stops. Install it with the `systemctl --user` commands the tool prints.

`autostart` only starts the agent. It does not change what gets printed: the agent still prints only
orders the owner has approved and marked paid, and each one still needs **Send to printer** unless the
owner switches on automatic sending for the shop (off by default; see "Known limits").

The computer must stay on, online and logged in for printing to happen. Orders wait in the
queue while it is off, and print when it comes back.

> Not yet checked on a real shop computer. Run the hardware checklist below before relying on it.

## What the owner sees

| Job state | Meaning |
|---|---|
| Waiting for a printing computer | Queued; no computer has picked it up yet |
| Being sent to the printer | The computer has taken the job |
| Printing | The computer has told QRquick it is sending the file |
| Sent to the printer | The printer system accepted the job (paper is not confirmed) |
| Not printed | Failed with a reason shown in plain words; **Print again** is offered |
| Check the printer | The page may already have printed; **Print again** asks for confirmation |

## Removing a computer

In the owner app, press **Remove** next to the computer. Its token stops working at once, and
the agent stops with a message to pair again.

## Files on this computer

- `agent.json` — server address, token, shop name, fallback printer. Keep it private.
- `outbox.json` — the agent's own notes about the job it is printing, and results not yet sent.
  Do not delete it while the agent is running.

## Tests (for developers)

```
cd agent
npm test
```

61 unit tests cover: the duplicate-print rules, the printer option parsing for CUPS and
PowerShell, the picture-to-PDF wrapper, the CLI and the API client. They do not print anything.

## Hardware checklist (do this before going live)

Tick each one on the real shop computer and printer. Record the result.

1. `doctor` passes on Windows and on Linux.
2. `printers` shows the real printer with the correct colour and double-sided flags.
3. `test-print` prints one page, in black and white, on the chosen printer.
4. A real order: approve it, mark it paid, press **Send to printer**. Check copies, colour mode,
   and double-sided output match the order.
5. Turn the printer off, then send an order. It should show **Not printed** with the offline reason,
   and print nothing when the printer is turned back on.
6. Stop the agent (Ctrl+C) while a job is printing. When it restarts, the owner should see
   **Check the printer**, and nothing should print again without the owner's confirmation.
7. **Remove** the computer in the owner app. The agent should stop and say to pair again.
8. Run the agent for a full day with several orders, and check the outbox empties.

Until items 3 to 5 pass, do not describe automatic printing as working.

## Known limits

- **Automatic sending.** Each shop has a switch in Orders > Printing computers, off by default. When
  it is on, an approved and paid order is queued as soon as the second of the two happens, with no press
  of **Send to printer**. Orders approved before the switch was turned on still need **Send to printer**.
  Status: the database change is written (migration 0018) but has not been run against a database or
  applied to the live project. Until it is applied, the switch cannot be saved.
- Windows: SumatraPDF settings (`-print-settings` with copies, `color`/`monochrome`, `duplexlong`)
  follow SumatraPDF's documented words but are not yet checked on a real installation.
- Windows: PowerShell `Get-PrintConfiguration` may need the printer driver to report colour and
  duplex. When it cannot, colour and double-sided orders are refused rather than guessed.
- Linux: colour and duplex use the printer's own CUPS options (`ColorModel`, `Duplex` or
  `sides`). A colour printer with no black-and-white option may print in colour for
  black-and-white orders; the agent cannot force a mode the printer does not offer.
- Paper size is A4 only. Orientation, page ranges, fit-to-page and passport sheet layout are not implemented. Cropping and brightness/contrast happen on the customer's page before upload, so the agent receives the edited picture.
- No printing confirmation: the agent knows the job was accepted by the printing system, not
  that paper came out.
