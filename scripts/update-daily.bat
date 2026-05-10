@echo off
:: Script de Atualizacao Diaria BeautyProcure
:: Vai para a raiz do projeto (um nivel acima de scripts/)
cd /d "%~dp0.."

echo [%date% %time%] Iniciando Sincronizacao Diaria... >> scripts\update-log.txt

:: 0. Atualiza os CSVs locais da ANVISA (fallback quando API estiver indisponivel)
::    - tmp/cosmeticos.csv           = cosmeticos registrados (Grau 2)
::    - tmp/cosmeticos_regularizados.csv = cosmeticos regularizados/isentos (Grau 1)
::    - tmp/medicamentos.csv         = medicamentos registrados
echo [%date% %time%] Atualizando CSVs locais... >> scripts\update-log.txt
call npx tsx scripts\update-csv.ts >> scripts\update-log.txt 2>&1

:: 1. Sincroniza Cosmeticos Registrados com Appwrite (via CSV baixado acima)
call npx tsx scripts\sync-anvisa.ts --type=cosmetico --dou >> scripts\update-log.txt 2>&1

:: 2. Sincroniza Medicamentos com Appwrite
call npx tsx scripts\sync-anvisa.ts --type=medicamento --dou >> scripts\update-log.txt 2>&1

:: 3. Cosmeticos Isentos de Registro (notificados) via Playwright — ANVISA bloqueia Node.js
call npx tsx scripts\sync-isentos.ts --all >> scripts\update-log.txt 2>&1

:: 4. Inteligencia DOU via tsx (nao depende do servidor Next.js estar rodando)
call npx tsx scripts\discover-dou.ts >> scripts\update-log.txt 2>&1

echo [%date% %time%] Sincronizacao concluida. >> scripts\update-log.txt
