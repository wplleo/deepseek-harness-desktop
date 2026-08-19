; 安装后用独立 appicon.ico 重建快捷方式,绕开 exe 内嵌图标的 Windows 缓存
!macro customInstall
  CreateShortCut "$newDesktopLink" "$appExe" "" "$INSTDIR\appicon.ico" 0
  CreateShortCut "$newStartMenuLink" "$appExe" "" "$INSTDIR\appicon.ico" 0
!macroend
