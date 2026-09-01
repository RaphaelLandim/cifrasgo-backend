# Investigacao de Compatibilidade Android 4.4 / API 19

Atualizado em: 2026-05-25

## 1. Resumo

Foi investigada a viabilidade de gerar uma variante Android do CifrasGo compatível com Android 4.4, API 19, sem alterar o app, sem mexer em SongDetail e sem fazer downgrade de dependencias nesta etapa.

Conclusao tecnica: **inviavel no stack Android atual**.

O bloqueio aparece antes da compilacao do app: ao tentar usar `minSdkVersion = 19`, o merge de manifests falha porque `org.apache.cordova:framework:14.0.1` declara `minSdkVersion 24`. Esse framework entra pela cadeia do Capacitor Android atual.

## 2. Stack Android atual

Arquivos verificados:

- `android/variables.gradle`
- `android/app/build.gradle`
- `android/build.gradle`
- `android/settings.gradle`
- `android/capacitor.settings.gradle`
- `android/app/capacitor.build.gradle`
- `android/gradle/wrapper/gradle-wrapper.properties`
- `package.json`
- `capacitor.config.ts`
- dependencias instaladas em `node_modules/@capacitor/*`

Versoes atuais relevantes:

- `@capacitor/core`: `8.3.3`
- `@capacitor/android`: `8.3.3`
- `@capacitor/cli`: `8.3.3`
- `@capacitor/app`: `8.1.0`
- `@capacitor/filesystem`: `8.1.2`
- `@capacitor/share`: `8.0.1`
- Android Gradle Plugin: `8.13.0`
- Gradle Wrapper: `8.14.3`
- `compileSdkVersion`: `36`
- `targetSdkVersion`: `36`
- `minSdkVersion` atual do projeto: `24`
- `cordovaAndroidVersion`: `14.0.1`

## 3. MinSdk exigido pelo projeto/dependencias

O projeto define em `android/variables.gradle`:

```gradle
minSdkVersion = 24
compileSdkVersion = 36
targetSdkVersion = 36
cordovaAndroidVersion = '14.0.1'
```

O modulo nativo do Capacitor tambem usa `minSdkVersion` padrao `24` quando nao recebe outro valor:

```gradle
minSdkVersion project.hasProperty('minSdkVersion') ? rootProject.ext.minSdkVersion : 24
```

O bloqueio confirmado vem de:

```gradle
implementation "org.apache.cordova:framework:$cordovaAndroidVersion"
```

Com a versao atual:

```gradle
org.apache.cordova:framework:14.0.1
```

## 4. Erro exato ao testar API 19

Foi executada uma tentativa temporaria com `minSdkVersion = 19`, restaurando `android/variables.gradle` para `24` ao final.

Comando usado:

```powershell
.\gradlew.bat :app:processDebugMainManifest --stacktrace
```

Erro principal:

```txt
C:\Projetos_Prog\Cifras_Vite\android\app\src\main\AndroidManifest.xml Error:
    uses-sdk:minSdkVersion 19 cannot be smaller than version 24 declared in library [org.apache.cordova:framework:14.0.1] C:\Users\Raphaellima\.gradle\caches\8.14.3\transforms\e47013dec160bb8e8e78795049f410c2\transformed\framework-14.0.1\AndroidManifest.xml as the library might be using APIs not available in 19
    Suggestion: use a compatible library with a minSdk of at most 19,
        or increase this project's minSdk version to at least 24,
        or use tools:overrideLibrary="org.apache.cordova" to force usage (may lead to runtime failures)
```

Falha final:

```txt
Execution failed for task ':app:processDebugMainManifest'.
> Manifest merger failed : uses-sdk:minSdkVersion 19 cannot be smaller than version 24 declared in library [org.apache.cordova:framework:14.0.1]
```

Observacao operacional: a primeira tentativa dentro do sandbox falhou antes por acesso negado ao lock do Gradle Wrapper em `~/.gradle`. A tentativa fora do sandbox chegou ao erro real do manifest merger.

## 5. Dependencia que bloqueia Android 4

Bloqueio direto confirmado:

- `org.apache.cordova:framework:14.0.1`
- declarada via `@capacitor/android`
- minSdk exigido: `24`

Arquivos relevantes:

- `android/variables.gradle`: define `cordovaAndroidVersion = '14.0.1'`
- `node_modules/@capacitor/android/capacitor/build.gradle`: consome `cordovaAndroidVersion` e declara `implementation "org.apache.cordova:framework:$cordovaAndroidVersion"`

Mesmo que esse bloqueio fosse forçado com `tools:overrideLibrary`, o proprio erro do Android alerta que isso pode causar falhas em runtime. Nao e uma solucao segura.

## 6. Caminho realista para Android 4.4

Com o stack atual, nao ha caminho realista apenas trocando `minSdkVersion`.

Para tentar suportar API 19 seria necessario criar uma variante legado separada, com uma cadeia Android antiga, provavelmente envolvendo:

- downgrade grande de Capacitor;
- downgrade de Cordova Android para uma versao que ainda aceite API 19;
- downgrade ou troca de plugins nativos;
- revisao de AndroidX;
- revisao do Android Gradle Plugin e Gradle Wrapper;
- possivel retirada ou substituicao de recursos nativos de compartilhamento/arquivos;
- ajustes de build para Java/SDK antigos;
- testes em WebView Android 4.4 real.

Isso deixaria de ser "uma variante simples" e viraria praticamente um segundo app Android legado.

## 7. Riscos de downgrade

Riscos altos:

- quebrar compatibilidade com Capacitor 8;
- quebrar `@capacitor/filesystem` e `@capacitor/share`;
- perder o fluxo atual de compartilhamento nativo Android;
- aumentar risco em backup/exportacao/importacao de arquivos;
- reduzir seguranca e compatibilidade com Play Store/SDK moderno;
- incompatibilidade com APIs AndroidX atuais;
- necessidade de manter duas cadeias de build;
- alto risco de regressao em Android/WebView.

Riscos especificos do Android 4.4:

- WebView muito antigo, com suporte limitado a JavaScript/CSS moderno;
- possivel incompatibilidade com bundle atual Vite/React 19;
- problemas de TLS/certificados em sites e backend online;
- desempenho baixo em telas pesadas;
- comportamento imprevisivel de iframe, Web Audio, clipboard, File APIs e compartilhamento;
- esforco de QA desproporcional para uma plataforma muito antiga.

## 8. Alternativa recomendada

Recomendacao: **manter `minSdkVersion = 24` no app principal**.

Alternativas mais seguras:

1. Manter o APK oficial em API 24+.
2. Se houver usuario critico em Android 4.4, avaliar uma versao legado separada, com escopo reduzido e sem compromisso de paridade completa.
3. Para aparelhos antigos, preferir acesso web/PWA quando o navegador permitir, sabendo que Android 4.4 tambem pode ter limitacoes severas de WebView/navegador.
4. Registrar Android 7/API 24 como minimo tecnico suportado para a linha atual do CifrasGo.

Nao recomendado:

- usar `tools:overrideLibrary="org.apache.cordova"` para forcar API 19;
- reduzir `minSdkVersion` no projeto atual;
- fazer downgrade amplo de Capacitor dentro da linha principal;
- misturar suporte Android 4.4 com as refatoracoes sensiveis atuais.

## 9. Conclusao

Classificacao: **inviavel no projeto atual**.

Motivo principal: a cadeia Android atual do Capacitor 8 usa `org.apache.cordova:framework:14.0.1`, que exige `minSdkVersion 24`. O build com API 19 falha no merge de manifests antes de gerar APK.

Classificacao alternativa: **parcialmente viavel apenas como projeto legado separado**, com downgrade grande, escopo reduzido e risco alto. Esse caminho nao deve ser tratado como ajuste pequeno de `variables.gradle`.

## 10. Estado final da investigacao

- `android/variables.gradle` foi restaurado para `minSdkVersion = 24`.
- Nenhum codigo funcional do app foi alterado.
- SongDetail, auto-scroll, swipe, parser, post-it, audio, modo Play, storage e features nao foram modificados.
- Nao foi feito downgrade nem atualizacao de dependencias.
- Documento criado apenas para registrar o diagnostico tecnico.
