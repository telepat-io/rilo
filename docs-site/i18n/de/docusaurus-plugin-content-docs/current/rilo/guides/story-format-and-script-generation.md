---
slug: /guides/story-format-and-script-generation
sidebar_position: 3
title: Geschichtenformat und Drehbuchgenerierung
---

Geben Sie eine klare Geschichte mit Kontext, Handlungsschritten und gewünschtem Ton an.

Die Rilo-Drehbuchgenerierung zielt auf die Dauer ab und kann wiederholen, wenn die Ausgabelänge außerhalb der Zielgrenzen liegt.

Tipps für die Eingabe der Geschichte:
- Beziehen Sie Schauplatz, Zeitstrahl und wichtige Wendepunkte ein.
- Bevorzugen Sie konkrete Details vor abstrakten Aufforderungen.
- Halten Sie einen klaren Erzählbogen pro Projekt ein.

Die visuelle Planung verwendet die gemessene Sprechertext-Dauer:

`segments = ceil(audioDurationSec / 5)`

Dies verhindert, dass die visuellen Elemente vor dem Sprechertext enden.

Verwandte Seiten:
- [Pipeline-Stufen](/guides/pipeline-stages)
- [Regeneration und Invalidierung](/guides/regeneration-and-invalidation)
