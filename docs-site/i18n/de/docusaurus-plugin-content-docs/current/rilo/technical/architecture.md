---
slug: /technical/architecture
sidebar_position: 1
title: Architektur
---

Die Rilo-Architektur konzentriert sich auf einen Pipeline-Orchestrator mit isolierten Stufenmodulen.

Hauptbereiche:
- Orchestrator und Laufzustandsübergänge
- Generierungsstufen und Adapter-Registrierungen
- API-Wege und Auth-Middleware
- Speicher-Backends und Synchronisation
- Worker-Verarbeitungsschleife

Kern-Laufzeit-Schleife:
1. API oder CLI erstellt/setzt einen Projektlauf fort.
2. Orchestrator führt Generierungsstufen der Reihe nach aus.
3. Artefakte und Laufzustand werden nach jeder Stufe persistiert.
4. Regenerierungsanfragen invalidieren nur nachgelagerte Stufen.

Siehe auch:
- [Pipeline- und Invalidierungsdiagramme](/technical/pipeline-and-invalidation-diagrams)
- [Orchestrator und Checkpointing](/technical/orchestrator-and-checkpointing)
