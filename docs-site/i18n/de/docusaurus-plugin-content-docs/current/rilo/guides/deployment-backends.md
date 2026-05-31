---
slug: /guides/deployment-backends
sidebar_position: 9
title: Deployment-Backends
---

Rilo unterstützt:
- Lokales Backend (Standard)
- Firebase-Backend (Firestore + Cloud Storage)

Kern-Backend-Umgebungsvariablen:

```bash
RILO_OUTPUT_BACKEND=local
RILO_FIREBASE_PROJECT_ID=
RILO_FIREBASE_STORAGE_BUCKET=
RILO_FIREBASE_CLIENT_EMAIL=
RILO_FIREBASE_PRIVATE_KEY=
```

## Lokales Backend

Verwenden Sie `RILO_OUTPUT_BACKEND=local` für reine Dateisystem-Entwicklung.
Artefakte und Zustand werden unter Projektverzeichnissen gespeichert.

## Firebase-Backend

Verwenden Sie `RILO_OUTPUT_BACKEND=firebase`, um den Projektzustand in Firestore und Assets in Cloud Storage zu spiegeln.

Empfohlene Einrichtung:
1. Erstellen Sie ein Service-Konto mit Firestore + Storage-Zugriff.
2. Stellen Sie Projekt-ID, Bucket, Client-E-Mail und privaten Schlüssel als Umgebungsvariablen bereit.
3. Überprüfen Sie die Bucket-Berechtigungen für Upload/Lese-Operationen.

Wenn Firebase-Anmeldedaten fehlen oder ungültig sind, schreiben Synchroperationen fehl.

Siehe [Umgebungsvariablen](/reference/environment-variables) für die vollständige Laufzeitkonfiguration.
