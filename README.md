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