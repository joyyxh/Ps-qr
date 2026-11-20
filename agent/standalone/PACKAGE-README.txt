QRquick print agent - install guide
===================================

The print agent runs on the shop computer that is connected to the printer. It asks QRquick for
approved, paid orders and prints them. This package contains the agent and this guide. You do not
need Node.js. You do need the printing software named below.

STATUS: the agent has been tested with fake printers only. It has NOT yet been tested on a real
printer. Print a test page and check it before you rely on the agent for orders.

Before you start
----------------
In the QRquick owner app, open Orders > Printing computers > Connect a printing computer. It shows a
server address and a pairing code. The code is valid for 10 minutes and works once. Keep both on screen,
or write them down: the agent asks for them the first time it starts.

Check the download first (recommended)
--------------------------------------
The release page lists a SHA-256 hash for each file, and SHA256SUMS.txt lists them all.
- Windows: open PowerShell in the download folder and run
    certutil -hashfile qrquick-print-agent-windows-x64.zip SHA256
  After unzipping, you can also check the program itself:
    certutil -hashfile qrquick-print-agent.exe SHA256
  The result must match the hash for that file on the release page.
- Linux: run  sha256sum -c SHA256SUMS.txt  in the download folder. Every line must end in OK.
If a hash does not match, do not run the file. Download it again from the release page.

Windows 10 or 11
----------------
1. Install SumatraPDF from https://www.sumatrapdfreader.org/ . Use the normal installer, not the
   portable version. The agent prints PDF files with it.
2. Unzip the download (right-click the zip, then Extract All). Copy qrquick-print-agent.exe to a fixed
   folder, for example C:\QRquick\ .
3. Double-click qrquick-print-agent.exe. A console window opens and:
   - asks for the server address and the pairing code (the first time only),
   - lists the printers on this computer and asks which one to use for QRquick,
   - starts printing and keeps running.
   Keep the window open while the shop is open. Press Ctrl+C to stop the agent. If the agent stops or
   fails, the window waits for Enter, so you can read the message before it closes.
4. To start the agent automatically when this computer starts, open PowerShell in that folder and run
     .\qrquick-print-agent.exe autostart
   then the two schtasks commands it prints. You only need to do this once.

Windows may say "Windows protected your PC" the first time, because the program is not signed with a
publisher certificate. Check the hash first. Then choose "More info", and "Run anyway".

For a technician, in PowerShell in the folder with the .exe:
   .\qrquick-print-agent.exe pair <server-address> <pairing-code>
   .\qrquick-print-agent.exe printers
   .\qrquick-print-agent.exe set-printer "Office Printer"
   .\qrquick-print-agent.exe doctor
   .\qrquick-print-agent.exe test-print
   .\qrquick-print-agent.exe run

Linux (Ubuntu or Debian)
------------------------
1. Install the printing system: sudo apt install cups
2. Add the printer at http://localhost:631 and print a test page from CUPS first.
3. Unzip the download and open the folder in the file manager.
4. If the file will not open, make it runnable: in its Properties, allow it to run as a program, or run
     chmod +x qrquick-print-agent
   in a terminal in that folder.
5. Right-click qrquick-print-agent and choose "Run in Terminal". The agent needs that terminal window to
   ask its questions and show its messages. If you double-click it without a terminal, nothing appears.
   That is expected: use Run in Terminal instead.
6. Follow the same steps as on Windows. The terminal asks for the server address, the pairing code and
   the printer. Keep the window open while the shop is open. Press Ctrl+C to stop the agent.
7. To start the agent automatically at sign-in, run  ./qrquick-print-agent autostart  in a terminal, then
   the systemctl commands it prints.

For a technician, in a terminal in the folder with the agent:
   ./qrquick-print-agent pair <server-address> <pairing-code>
   ./qrquick-print-agent printers
   ./qrquick-print-agent set-printer "Office Printer"
   ./qrquick-print-agent doctor
   ./qrquick-print-agent test-print
   ./qrquick-print-agent run

Browsers (Brave, Chrome, Edge, Firefox)
---------------------------------------
Brave and Chrome may say that the file "isn't commonly downloaded" or ask whether to keep it. Firefox may
ask you to save it. Check the hash above, then keep the file. Download it only from the release page of
the repository that published this agent.

Things to know
--------------
- The agent prints A4 paper only.
- It prints only orders the owner has approved and marked as paid. It never prints the same job twice by
  itself. If it cannot tell whether a page came out, the owner app shows "Check the printer".
- The token that connects this computer to the shop is stored in a private file on this computer. It is
  never printed.
- Revoke the computer in the owner app if it is lost or sold.
