@echo off
echo Checking for processes using port 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Found process using port 3001: %%a
    taskkill /PID %%a /F
    echo Process killed successfully!
)
echo Done!
pause

