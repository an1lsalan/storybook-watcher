## Konfiguration per Kommandozeile

Du kannst das Verhalten des Watchers mit folgenden Optionen anpassen:

| Option                         | Alias | Beschreibung                                                                    | Standardwert                                  |
| ------------------------------ | ----- | ------------------------------------------------------------------------------- | --------------------------------------------- |
| `--componentsDir <pfad>`       | `-c`  | Pfad zum Komponentenverzeichnis (relativ zum Projekt)                           | `src/components`                              |
| `--storiesDir <pfad>`          | `-s`  | Pfad zum Stories-Verzeichnis (relativ zum Projekt). Wenn nicht gesetzt, dynamisch | Dynamisch (`src/stories` oder `stories`)      |
| `--componentExts <exts>`       | `-e`  | Komma-separierte Liste von Komponenten-Endungen (z.B. ".tsx,.jsx")              | `.tsx,.jsx`                                   |
| `--storyExt <ext>`             | `-x`  | Dateiendung für generierte Story-Dateien                                        | `.stories.tsx`                                |
| `--defaultStoryName <name>`    | `-n`  | Name des Standard-Story-Exports                                                 | `Default`                                     |
| `--help`                       | `-h`  | Zeigt diese Hilfe an                                                            |                                               |

**Beispiel:**

```bash
sb-watch -c ./app/ui -s ./app/storybook-files -e .tsx,.vue -x .stories.js -n BaseStory
```

## Konfiguration per Datei

Du kannst `storybook-path-watcher` auch über eine Konfigurationsdatei im Wurzelverzeichnis deines Projekts einrichten. Das CLI-Tool sucht automatisch nach folgenden Dateien (Reihenfolge der Priorität):

* `package.json` (im Feld `"sbwatch"`)
* `.sbwatchrc` (JSON oder YAML)
* `.sbwatchrc.json`
* `.sbwatchrc.yaml` / `.sbwatchrc.yml`
* `.sbwatchrc.js` (exportiert ein Objekt via `module.exports`)
* `.sbwatchrc.cjs` (exportiert ein Objekt via `module.exports`)
* `sbwatch.config.js` (exportiert ein Objekt via `module.exports`)
* `sbwatch.config.cjs` (exportiert ein Objekt via `module.exports`)

**Beispiel für eine `.sbwatchrc.json`:**

```json
{
  "componentsDir": "app/ui-components",
  "storiesDir": "app/storybook/stories",
  "componentExts": ".tsx,.js",
  "storyExt": ".stories.jsx",
  "defaultStoryName": "MyStory",
  "ignoredPathsRegexString": "(\\.test\\.(ts|tsx|js|jsx)$)|(/node_modules|/dist)/",
  "MAX_RECURSION_DEPTH": 3
}
