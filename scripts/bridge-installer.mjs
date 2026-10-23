import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import nsis from "app-builder-lib/out/toolsets/windows.js";
import { bridgePackageFiles } from "./bridge-package.mjs";
import { BRIDGE_VERSION } from "../bridge/server.mjs";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

// Paths are supplied by the build, never by a web page or a media URL. NSIS
// treats $ as interpolation even inside a quoted literal, so escape it too.
function literal(value) { return String(value).replace(/\$/g, () => '$$').replace(/"/g, '$\\"').replace(/\r|\n/g, ''); }

export function installerScript({ payload, output, version = BRIDGE_VERSION, files }) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Invalid bridge installer version");
  if (files.some(name => !/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/.test(name))) throw new Error("Invalid installer payload filename");
  const source = literal(payload.replace(/\\/g, '/'));
  const destination = literal(output.replace(/\\/g, '/'));
  return `Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
Name "TCLV Bridge"
OutFile "${destination}"
InstallDir "$LOCALAPPDATA\\Programs\\TCLVBridge"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show
AllowSkipFiles off
VIProductVersion "${version}.0"
VIAddVersionKey /LANG=1033 "ProductName" "TCLV Bridge"
VIAddVersionKey /LANG=1033 "FileDescription" "TCLV Bridge per-user setup"
VIAddVersionKey /LANG=1033 "FileVersion" "${version}"
VIAddVersionKey /LANG=1033 "LegalCopyright" "TCLVPlayer contributors"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "TCLV Bridge"
!define MUI_WELCOMEPAGE_TEXT "Play web video through this computer, without a remote video proxy.$\\r$\\n$\\r$\\nInstalls for your Windows account. No administrator password or separate Node.js installation is needed.$\\r$\\n$\\r$\\nKeep the bridge window open while watching. It does not start automatically with Windows."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${source}/LICENSE"
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Start TCLV Bridge and open the web player"
!define MUI_FINISHPAGE_RUN_FUNCTION StartBridge
!define MUI_FINISHPAGE_TEXT "Return to the web player and choose Connect. Confirm the website in the local approval window.$\\r$\\n$\\r$\\nUse the TCLV Bridge shortcut in the Start menu next time. Close its window to stop it."
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  SetShellVarContext current
  \${IfNot} \${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "TCLV Bridge requires 64-bit Windows 10 or newer."
    Abort
  \${EndIf}
  \${IfNot} \${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "TCLV Bridge requires Windows 10 or newer."
    Abort
  \${EndIf}
FunctionEnd

Function un.onInit
  SetShellVarContext current
FunctionEnd

Function StartBridge
  SetOutPath "$INSTDIR"
  Exec '"$INSTDIR\\node.exe" "$INSTDIR\\start.mjs" --open'
FunctionEnd

Section "TCLV Bridge" Main
  SetOutPath "$INSTDIR"
${files.map(name => `  File "/oname=${name}" "${source}/${literal(name)}"`).join('\n')}
  WriteUninstaller "$INSTDIR\\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\\TCLV Bridge"
  CreateShortCut "$SMPROGRAMS\\TCLV Bridge\\TCLV Bridge.lnk" "$INSTDIR\\node.exe" '"$INSTDIR\\start.mjs" --open' "$INSTDIR\\node.exe" 0
  CreateShortCut "$SMPROGRAMS\\TCLV Bridge\\Uninstall.lnk" "$INSTDIR\\Uninstall.exe"
  WriteRegStr HKCU "Software\\Classes\\tclvbridge" "" "URL:TCLV Bridge"
  WriteRegStr HKCU "Software\\Classes\\tclvbridge" "URL Protocol" ""
  ; Deliberately no %1: a URI cannot inject Node flags, paths or a provider URL.
  WriteRegStr HKCU "Software\\Classes\\tclvbridge\\shell\\open\\command" "" '"$INSTDIR\\node.exe" "$INSTDIR\\start.mjs" --open'
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\TCLVBridge" "DisplayName" "TCLV Bridge"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\TCLVBridge" "DisplayVersion" "${version}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\TCLVBridge" "Publisher" "TCLVPlayer contributors"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\TCLVBridge" "UninstallString" '"$INSTDIR\\Uninstall.exe"'
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\TCLVBridge" "NoModify" 1
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\TCLVBridge" "NoRepair" 1
SectionEnd

Section "Uninstall"
  ; Do not remove a protocol that has since been registered by another install.
  ReadRegStr $0 HKCU "Software\\Classes\\tclvbridge\\shell\\open\\command" ""
  StrCmp $0 '"$INSTDIR\\node.exe" "$INSTDIR\\start.mjs" --open' 0 +2
  DeleteRegKey HKCU "Software\\Classes\\tclvbridge"
  ReadRegStr $0 HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\TCLVBridge" "UninstallString"
  StrCmp $0 '"$INSTDIR\\Uninstall.exe"' 0 +2
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\TCLVBridge"
${files.map(name => `  Delete "$INSTDIR\\${literal(name)}"`).join('\n')}
  Delete "$INSTDIR\\Uninstall.exe"
  Delete "$SMPROGRAMS\\TCLV Bridge\\TCLV Bridge.lnk"
  Delete "$SMPROGRAMS\\TCLV Bridge\\Uninstall.lnk"
  RMDir "$SMPROGRAMS\\TCLV Bridge"
  ; No recursive removal: leave any unrelated files in the chosen directory.
  RMDir "$INSTDIR"
SectionEnd
`;
}

export async function createBridgeInstaller(destination, {
  files, loadRuntime, version = BRIDGE_VERSION,
  compiler = () => nsis.getMakeNsisPath(),
  compile = async (tool, script) => {
    await run(tool.path, ["-V2", script], { env: { ...process.env, ...tool.env }, timeout: 180000, maxBuffer: 1024 * 1024 });
  },
} = {}) {
  const payloadFiles = files || await bridgePackageFiles({ runtime: true, loadRuntime });
  if (!payloadFiles.some(file => file.name === "node.exe" && file.data.subarray(0, 2).equals(Buffer.from("MZ")))) {
    throw new Error("Windows bridge installer requires the verified Windows runtime");
  }
  const temporary = await mkdtemp(join(tmpdir(), "tclv-bridge-installer-"));
  try {
    for (const file of payloadFiles) {
      if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/.test(file.name)) throw new Error("Invalid installer payload filename");
      await writeFile(join(temporary, file.name), file.data);
    }
    const output = resolve(destination);
    await mkdir(dirname(output), { recursive: true });
    const script = join(temporary, "bridge-setup.nsi");
    await writeFile(script, installerScript({ payload: temporary, output, version, files: payloadFiles.map(file => file.name) }));
    await rm(output, { force: true });
    try { await compile(await compiler(), script); } catch (error) { await rm(output, { force: true }); throw error; }
    const executable = await readFile(output);
    if (executable.subarray(0, 2).toString() !== "MZ") throw new Error("NSIS did not produce a Windows setup executable");
    return { version, bytes: executable.length };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = resolve(root, "dist/bridge/TCLV-Bridge-Setup.exe");
  const result = await createBridgeInstaller(output);
  console.log("Bridge setup:", output, result.bytes, "bytes");
}
