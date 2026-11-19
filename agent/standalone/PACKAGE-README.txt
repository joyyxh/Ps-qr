QRquick print agent - install guide
===================================

The print agent runs on the shop computer that is connected to the printer. It asks QRquick for
approved, paid orders and prints them. This package contains one file, the agent. You do not need
Node.js or any other program from the internet, except the printing software named below.

STATUS: the agent has been tested with fake printers only. It has NOT yet been tested on a real
printer. Run "test-print" and check the page before you rely on it for orders.

Get the pairing code first
--------------------------
In the QRquick owner app, open Orders > Printing computers > Connect a printing computer. The code
is valid for 10 minutes and works once. Your server address is https://<project-ref>.supabase.co/functions/v1/print-agent
(the owner app shows the exact address next to the code).

Windows 10 or 11
----------------
1. Install SumatraPDF from https://www.sumatrapdfreader.org/ . Use the normal installer, not the
   portable version. The agent prints PDF files with it.
2. Copy qrquick-print-agent.exe to a fixed folder, for example C:\QRquick\.
3. Open PowerShell in that folder and run these, one line at a time:

   .\qrquick-print-agent.exe pair <server-address> <pairing-code>
   .\qrquick-print-agent.exe printers
   .\qrquick-print-agent.exe set-printer "Office Printer"
   .\qrquick-print-agent.exe doctor
   .\qrquick-print-agent.exe test-print
   .\qrquick-print-agent.exe run

4. Keep the window open while the shop is open. Ctrl+C stops it safely.
5. To start it automatically at sign-in, run ".\qrquick-print-agent.exe autostart" and then the
   two schtasks commands it prints.

Windows may say "Windows protected your PC" the first time, because this file is not signed with a
publisher certificate. Choose "More info", then "Run anyway", only for this file from this download.

Linux (Ubuntu or Debian)
------------------------
1. Install the printing system: sudo apt install cups
2. Add the printer at http://localhost:631 and print a test page from CUPS first.
3. Make the file runnable: chmod +x qrquick-print-agent
4. Run the same commands as above, with ./qrquick-print-agent in place of .\qrquick-print-agent.exe
5. For autostart, run ./qrquick-print-agent autostart and then the systemctl commands it prints.

Things to know
--------------
- The agent prints A4 paper only.
- It prints only orders the owner has approved and marked as paid. It never prints the same job
  twice by itself. If it cannot tell whether a page came out, the owner app shows "Check the printer".
- The token that connects this computer to the shop is stored in a private file on this computer. It
  is never printed.
- Revoke the computer in the owner app if it is lost or sold.
