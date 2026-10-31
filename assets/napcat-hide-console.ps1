[CmdletBinding()]
param(
  [string]$Names = 'QQ,NapCatWinBootMain',
  [int]$Seconds = 0
)
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class DshConsoleWindowHider {
  private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr hWnd, StringBuilder className, int maxCount);
  [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hWnd, int command);
  public static int HideForProcesses(string[] names) {
    int hidden = 0;
    EnumWindows((hWnd, lParam) => {
      uint pid;
      GetWindowThreadProcessId(hWnd, out pid);
      try {
        var process = System.Diagnostics.Process.GetProcessById((int)pid);
        if (Array.IndexOf(names, process.ProcessName) < 0) return true;
      } catch { return true; }
      var cls = new StringBuilder(128);
      GetClassName(hWnd, cls, cls.Capacity);
      if (cls.ToString() == "ConsoleWindowClass") {
        ShowWindow(hWnd, 0);
        hidden++;
      }
      return true;
    }, IntPtr.Zero);
    return hidden;
  }
}
"@
$processNames = $Names.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
$deadline = (Get-Date).AddSeconds([Math]::Max(0, $Seconds))
[void][DshConsoleWindowHider]::HideForProcesses($processNames)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 250
  [void][DshConsoleWindowHider]::HideForProcesses($processNames)
}
