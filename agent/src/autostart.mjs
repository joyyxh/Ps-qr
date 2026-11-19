import path from 'node:path';

// Start-at-login files for the print agent: a Windows Task Scheduler task or a Linux systemd user
// service. Both run "node <agent>/bin/qrquick-print-agent.mjs run" and restart it after a failure.
// In the single-file build there is no script: nodePath is the executable and scriptPath is empty,
// so both run "<executable> run". The files only start the agent. They do not change what it prints.

export const TASK_NAME = 'QRquick print agent';
export const SERVICE_NAME = 'qrquick-print-agent';

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Task Scheduler exports tasks as UTF-16 with a byte-order mark, so the file is written the same way.
export function windowsTaskXml({ nodePath, scriptPath, workingDir, userId = '' }) {
  const user = userId ? `<UserId>${xmlEscape(userId)}</UserId>` : '';
  const xml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Runs the QRquick print agent when you sign in, so approved orders print without anyone starting it.</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      ${user}
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      ${user}
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>999</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${xmlEscape(nodePath)}</Command>
      <Arguments>${xmlEscape(scriptPath ? `"${scriptPath}" run` : 'run')}</Arguments>
      <WorkingDirectory>${xmlEscape(workingDir)}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
`;
  return { fileName: 'QRquick-print-agent.xml', content: `﻿${xml}`, encoding: 'utf16le' };
}

// systemd reads ExecStart with words separated by spaces, so each path is quoted.
function systemdQuote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function systemdUnit({ nodePath, scriptPath, workingDir }) {
  const content = `[Unit]
Description=QRquick print agent (prints approved, paid orders for this shop)
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
WorkingDirectory=${workingDir}
ExecStart=${systemdQuote(nodePath)}${scriptPath ? ` ${systemdQuote(scriptPath)}` : ''} run
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
`;
  return { fileName: `${SERVICE_NAME}.service`, content, encoding: 'utf8' };
}

// The file, the folder it is written to, and the commands that install and remove it, for one platform.
// `fileDir` is the folder the file is written to; the commands use its full path so they work from anywhere.
export function autostartFiles(platform, { nodePath, scriptPath, workingDir, userId, fileDir }) {
  if (platform === 'win32') {
    const file = windowsTaskXml({ nodePath, scriptPath, workingDir, userId });
    const xmlPath = path.join(fileDir, file.fileName);
    return {
      ...file,
      path: xmlPath,
      install: [
        `schtasks /Create /TN "${TASK_NAME}" /XML "${xmlPath}" /F`,
        `schtasks /Run /TN "${TASK_NAME}"`,
      ],
      remove: [`schtasks /Delete /TN "${TASK_NAME}" /F`],
    };
  }
  const file = systemdUnit({ nodePath, scriptPath, workingDir });
  const unitPath = path.join(fileDir, file.fileName);
  return {
    ...file,
    path: unitPath,
    install: [
      'mkdir -p ~/.config/systemd/user',
      `cp "${unitPath}" ~/.config/systemd/user/`,
      'systemctl --user daemon-reload',
      `systemctl --user enable --now ${SERVICE_NAME}`,
    ],
    remove: [`systemctl --user disable --now ${SERVICE_NAME}`],
  };
}
