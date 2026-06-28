!macro stopTCLVPlayer
  DetailPrint "Stopping TCLVPlayer if it is running..."
  nsExec::ExecToStack 'taskkill /F /T /IM "TCLVPlayer.exe"'
  Pop $0
  Pop $1
!macroend

!macro customInit
  !insertmacro stopTCLVPlayer
!macroend

!macro customUnInit
  !insertmacro stopTCLVPlayer
!macroend
