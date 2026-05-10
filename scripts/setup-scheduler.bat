@echo off
:: setup-scheduler.bat
:: Registra a atualizacao diaria do BeautyProcure no Agendador de Tarefas do Windows
:: Execute como Administrador

echo Registrando tarefa agendada "BeautyProcure-DOU-Sync"...

:: Remove tarefa antiga se existir
schtasks /Delete /TN "BeautyProcure-DOU-Sync" /F 2>nul

:: Cria nova tarefa: todo dia util (Seg-Sex) as 07:30
schtasks /Create ^
  /TN "BeautyProcure-DOU-Sync" ^
  /TR "\"%~dp0update-daily.bat\"" ^
  /SC DAILY ^
  /ST 07:30 ^
  /RU "%USERNAME%" ^
  /RL HIGHEST ^
  /F

if %ERRORLEVEL% == 0 (
  echo.
  echo [OK] Tarefa agendada com sucesso!
  echo      Nome: BeautyProcure-DOU-Sync
  echo      Horario: Todo dia as 07:30
  echo      Script: %~dp0update-daily.bat
  echo.
  echo Para verificar: schtasks /Query /TN "BeautyProcure-DOU-Sync" /FO LIST
) else (
  echo.
  echo [ERRO] Falha ao criar tarefa. Execute este script como Administrador.
)

pause
