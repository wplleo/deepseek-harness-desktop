; 安装后用独立 appicon.ico 重建快捷方式，绕开 exe 内嵌图标的 Windows 缓存
; 注意：extraResources 实际把 appicon.ico 放在 $INSTDIR\resources\appicon.ico
; 用显式 $DESKTOP / $SMPROGRAMS 路径，不依赖 electron-builder 的内部变量
; （升级场景里那些变量可能为空，导致快捷方式建不出来）
!macro customInstall
  SetShellVarContext current
  CreateShortCut "$DESKTOP\DeepSeek Harness Desktop.lnk" "$appExe" "" "$INSTDIR\resources\appicon.ico" 0
  CreateShortCut "$SMPROGRAMS\DeepSeek Harness Desktop.lnk" "$appExe" "" "$INSTDIR\resources\appicon.ico" 0
!macroend

!macro customUnInstall
  SetShellVarContext current
  Delete "$DESKTOP\DeepSeek Harness Desktop.lnk"
  Delete "$SMPROGRAMS\DeepSeek Harness Desktop.lnk"
!macroend
