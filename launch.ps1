$env:ELECTRON_RUN_AS_NODE = $null
Set-Location "C:\Users\jklim\OneDrive\Documents\claude-projects\SCCM"
Start-Process -FilePath ".\node_modules\electron\dist\electron.exe" -ArgumentList "."
