<p align="center"><img src="./assets/avatar/rilo-logo.webp" width="128" alt="Rilo"></p>
<h1 align="center">Rilo</h1>
<p align="center"><em>Verwandle eine Geschichte in ein fertiges Video — KI-generiertes Skript, Voiceover, Keyframes und Komposition, alles mit einem Befehl.</em></p>

<p align="center">
  <a href="https://docs.telepat.io/rilo">📖 Docs</a>
  · <a href="./README.md">🇺🇸 English</a>
  · <a href="./README.zh-CN.md">🇨🇳 简体中文</a>
  · <a href="./README.de.md">🇩🇪 Deutsch</a>
</p>

<p align="center">
  <a href="https://github.com/telepat-io/rilo/actions/workflows/ci.yml"><img src="https://github.com/telepat-io/rilo/actions/workflows/ci.yml/badge.svg?branch=main" alt="Build"></a>
  <a href="https://codecov.io/gh/telepat-io/rilo"><img src="https://codecov.io/gh/telepat-io/rilo/graph/badge.svg" alt="Codecov"></a>
  <a href="https://www.npmjs.com/package/@telepat/rilo"><img src="https://img.shields.io/npm/v/@telepat/rilo" alt="npm"></a>
  <a href="https://github.com/telepat-io/rilo/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License"></a>
</p>

Rilo verwandelt eine Geschichte in ein fertiges Video — KI-generiertes Skript, Voiceover, Keyframes und Komposition, alles mit einem Befehl.

Schreiben Sie Ihre Geschichte in einfachem Text. Rilo übernimmt den Rest: Skripterstellung, Erzählung, visuelle Keyframes, Videosegmente und die finale Komposition – mit optionaler Untertitel-Synchronisation und Einbrennung.

Entwickelt für Kreative und Teams, die reproduzierbare, hochwertige Videos in großem Umfang ohne manuellen Schnitt benötigen.

## Features

- **Vollständige Pipeline, ein Befehl** — Story → Skript → Voiceover → Keyframes → Segmente → finales Video. `rilo --project demo --story-file ./story.txt`
- **Checkpoint-gestützte Durchläufe** — Jede Stufe speichert Artefakte. Setzen Sie beliebige Stufen fort oder generieren Sie sie selektiv neu. `rilo --project demo --force`
- **Ihre Modelle, Ihre Kontrolle** — Wählen Sie T2I- und I2V-Modelle. Überschreiben Sie modellspezifische Optionen. Wechseln Sie Modelle jederzeit.
- **Code-gesteuerte Pipeline** — Deterministische Orchestrierung, Checkpointing und Artefaktverwaltung. Tokens werden für die Generierung ausgegeben, nicht für Infrastruktur.
- **Untertitel-Synchronisation & Einbrennung** — Untertitel automatisch an Voiceover-Timing ausrichten. Ins finale Video einbrennen.
- **Vorschau-Dashboard** — Web-UI für Projektverwaltung, Neugenerierung und Asset-Vorschau. `rilo preview`
- **HTTP-API & Webhooks** — Bearer-Token-Authentifizierung, OpenAPI-3.1-Spezifikation, Webhook-Abonnements. Firebase oder lokal.
- **Plattformübergreifend** — macOS, Linux, Windows. Node.js 22+ und ffmpeg.

## Quick Start

Voraussetzungen: Node.js 22+, ffmpeg im PATH und ein Replicate API-Token.

```bash
npm install -g @telepat/rilo
rilo settings
rilo --project demo --story-file ./story.txt
```

Erwartetes Ergebnis:

- Ein Projektordner wird unter `projects/demo/` erstellt.
- Die vollständige Pipeline durchläuft Skript, Voiceover, Keyframes, Segmente und Komposition.
- Das finale Video wird unter `projects/demo/final.mp4` abgelegt.
- Dashboard-Vorschau verfügbar via `rilo preview`.

## Requirements

- Node.js 22+
- ffmpeg im PATH
- Replicate API-Token
- macOS, Linux oder Windows

## How It Works

Rilo durchläuft eine gestufte Pipeline: Skripterstellung, Voiceover-Synthese, Shot-Prompt-Generierung, Keyframe-Rendering, Segmentgenerierung und finale Videokomposition. Jede Stufe schreibt Checkpoint-Artefakte, sodass Sie selektiv fortsetzen oder neugenerieren können.

Die Konfiguration fasst CLI-Flags, Umgebungsvariablen und `~/.rilo/config.json` mit Schema-Defaults zusammen. Das Vorschau-Dashboard (`rilo preview`) startet eine lokale API, einen Worker und ein Vite-React-Frontend für Monitoring und Bearbeitung.

## Using With AI Agents

Rilo bietet mehrere Schnittstellen für agentische und automatisierte Workflows:

- **CLI-Automatisierung** — Die gesamte Generierung wird durch CLI-Flags und Umgebungsvariablen gesteuert. Nach der initialen Einrichtung sind keine interaktiven Prompts erforderlich.
- **HTTP-API** — `rilo preview` startet eine Express-API mit vollständigem Job- und Projekt-CRUD, Asset-Serving und Webhook-Endpunkten. Bearer-Token-Authentifizierung via `Authorization: Bearer <API_BEARER_TOKEN>`.
- **OpenAPI-Spezifikation** — Automatisch generierte OpenAPI-3.1-Spezifikation für schema-gesteuerte Agent-Integration.
- **Webhooks** — Abonnieren Sie Job-Lifecycle-Events für externe Orchestrierung.
- **Firebase Functions** — Stellen Sie `src/api/firebaseFunction.js` für serverloses API-Hosting bereit.
- **Agent-Dokumentation** — [API Reference](https://docs.telepat.io/rilo/reference/api-reference) behandelt Endpunkte, Authentifizierung und Webhooks.

## Security And Trust

- API-Tokens und Replicate-Zugangsdaten werden, wenn verfügbar, im OS-Keystore gespeichert (macOS Keychain, Windows Credential Manager, Linux Secret Service).
- Fallback auf eine AES-256-verschlüsselte Datei unter `~/.rilo/.secrets`, falls kein nativer Keystore verfügbar ist.
- Umgebungsvariablen (`TELEPAT_REPLICATE_TOKEN`, `RILO_API_BEARER_TOKEN`) haben höchste Priorität und überschreiben gespeicherte Werte.
- Der Preview-Modus `--expose` sollte nur in vertrauenswürdigen Netzwerken oder isolierten Umgebungen verwendet werden.

## Documentation And Support

- [Documentation site](https://docs.telepat.io/rilo)
- [Quickstart](https://docs.telepat.io/rilo/getting-started/quickstart)
- [CLI Reference](https://docs.telepat.io/rilo/reference/cli-reference)
- [Configuration Guide](https://docs.telepat.io/rilo/guides/configuration)
- [API Reference](https://docs.telepat.io/rilo/reference/api-reference)
- [Troubleshooting](https://docs.telepat.io/rilo/guides/troubleshooting)
- [Repository](https://github.com/telepat-io/rilo)
- [npm package](https://www.npmjs.com/package/@telepat/rilo)

## Contributing

Beiträge sind willkommen. Siehe [Development](https://docs.telepat.io/rilo/contributing/development) für lokale Einrichtung, Build-Befehle und Test-Workflows.

## License

MIT. Siehe [LICENSE](./LICENSE).
