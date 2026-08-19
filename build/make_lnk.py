import os, shutil
import win32com.client

desktop = os.path.expandvars(r'%USERPROFILE%\Desktop')
install_dir = os.path.expandvars(r'%LOCALAPPDATA%\Programs\DeepSeek Harness Desktop')
exe = os.path.join(install_dir, 'DeepSeek Harness Desktop.exe')
src_ico = r'E:/DeepSeek/rebuild/build/icon.ico'
ico = os.path.join(install_dir, 'appicon.ico')          # 安装目录内的独立 ico
lnk = os.path.join(desktop, 'DeepSeek Harness Desktop.lnk')

# 1) 把全新图标文件放进安装目录（Windows 对此路径无旧缓存 -> 强制显示新图标）
shutil.copy2(src_ico, ico)
print('copied ico ->', ico)

# 2) 直接覆盖重建桌面快捷方式（CreateShortcut 会覆盖同名文件）
shell = win32com.client.Dispatch('WScript.Shell')
s = shell.CreateShortcut(lnk)
s.TargetPath = exe
s.WorkingDirectory = install_dir
s.IconLocation = ico + ',0'
s.Description = 'DeepSeek Harness Desktop'
s.Save()
print('created', lnk)
print('  target', s.TargetPath)
print('  icon  ', s.IconLocation)
