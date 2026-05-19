@echo off
set "PROJECT_PATH=C:\Projetos_Prog\Cifras_Vite"
set "APK_SOURCE=%PROJECT_PATH%\android\app\build\outputs\apk\debug\app-debug.apk"
set "APK_DEST=%PROJECT_PATH%\CifrasGo.apk"

echo [1/4] Iniciando Build Web (Vite)...
cd /d "%PROJECT_PATH%"
call npm run build

echo [2/4] Sincronizando com Capacitor...
call npx cap copy android
call npx cap sync android

echo [3/4] Compilando APK nativo (Gradle)...
cd android
call .\gradlew.bat clean assembleDebug

echo [4/4] Verificando e movendo arquivo...
if exist "%APK_SOURCE%" (
    move /y "%APK_SOURCE%" "%APK_DEST%"
    echo.
    echo ======================================================
    echo SUCESSO! O arquivo novo esta na raiz:
    echo %APK_DEST%
    echo ======================================================
) else (
    echo.
    echo ########## ERRO: O APK nao foi gerado! ##########
    echo Verifique as mensagens do Gradle acima.
)

pause