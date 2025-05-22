# storybook-path-watcher

Ein Watcher, der automatisch Storybook-Stories für deine React/Next.js-Komponenten erstellt, aktualisiert und löscht.

## Features (Beispiel)

-   Überwacht dein Komponentenverzeichnis auf Änderungen.
-   Erstellt automatisch Basis-Story-Dateien für neue Komponenten.
-   Extrahiert Props (aus TypeScript) und fügt sie als `args` in die Stories ein.
-   Aktualisiert `args` bei Änderungen an den Komponenten-Props.
-   Löscht zugehörige Stories, wenn Komponenten entfernt werden.
-   Farbige Konsolenausgaben für bessere Lesbarkeit.

## Installation

Global (um den Befehl `sb-watch` überall verfügbar zu machen):
```bash
npm install -g storybook-path-watcher