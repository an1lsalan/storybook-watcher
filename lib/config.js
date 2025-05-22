// storybook-path-watcher/lib/config.js
const path = require('path');
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
const { cosmiconfigSync } = require('cosmiconfig'); // cosmiconfig importieren

const CWD = process.cwd();

// Standard-Defaultwerte für die Konfiguration
const DEFAULT_CONFIG = {
    componentsDir: path.join('src', 'components'),
    storiesDir: null, // Wird dynamisch, wenn null
    componentExts: '.tsx,.jsx',
    storyExt: '.stories.tsx',
    defaultStoryName: 'Default',
    ignoredPathsRegexString: '(\\.(test|spec)\\.(ts|tsx|js|jsx)$)|(\\/node_modules|\\.next|\\.storybook)\\/', // Als String für cosmiconfig
    MAX_RECURSION_DEPTH: 2,
};

function getConfig() {
    // 1. Lade Konfiguration aus Datei mit cosmiconfig
    const explorer = cosmiconfigSync('sbwatch'); // 'sbwatch' ist der Name, nach dem gesucht wird (z.B. .sbwatchrc.json)
    const result = explorer.search(CWD); // Suche vom aktuellen Arbeitsverzeichnis aus
    const configFileConfig = result ? result.config : {};

    // 2. Parse CLI-Argumente mit yargs
    // Die Defaults für yargs sind jetzt die Werte aus der Config-Datei oder die harten Defaults
    const yargsDefaults = { ...DEFAULT_CONFIG, ...configFileConfig };

    const argv = yargs(hideBin(process.argv))
        .option('componentsDir', {
            alias: 'c', type: 'string', default: yargsDefaults.componentsDir,
            description: 'Pfad zum Komponentenverzeichnis (relativ zu CWD)',
        })
        .option('storiesDir', {
            alias: 's', type: 'string', default: yargsDefaults.storiesDir, // Kann null sein für dynamische Erkennung
            description: 'Pfad zum Stories-Verzeichnis (relativ zu CWD). Wenn nicht gesetzt, wird dynamisch ermittelt.',
        })
        .option('componentExts', {
            alias: 'e', type: 'string', default: yargsDefaults.componentExts,
            description: 'Komma-separierte Liste von Dateiendungen für Komponenten',
        })
        .option('storyExt', {
            alias: 'x', type: 'string', default: yargsDefaults.storyExt,
            description: 'Dateiendung für generierte Story-Dateien',
        })
        .option('defaultStoryName', {
            alias: 'n', type: 'string', default: yargsDefaults.defaultStoryName,
            description: 'Name des Standard-Story-Exports',
        })
        // Weitere Optionen wie ignoredPathsRegexString, MAX_RECURSION_DEPTH könnten hier auch hinzugefügt werden
        .help().alias('help', 'h')
        .argv;

    // 3. Finale Konfiguration erstellen (CLI überschreibt Datei, Datei überschreibt Defaults)
    // Wir nehmen die geparsten argv, da yargs bereits die Defaults (aus Datei/Code) berücksichtigt hat.
    const config = {
        CWD,
        componentsDir: path.resolve(CWD, argv.componentsDir),
        componentFileExtensions: argv.componentExts.split(',').map(ext => ext.trim()),
        storyFileExtension: argv.storyExt,
        defaultStoryName: argv.defaultStoryName,
        // Für ignoredPathsRegex: Wenn es in der Config-Datei oder als CLI-Arg als String kommt, hier in RegExp umwandeln
        // Für dieses Beispiel bleibt es vorerst beim Default, kann aber erweitert werden:
        ignoredPathsRegex: new RegExp(configFileConfig.ignoredPathsRegexString || DEFAULT_CONFIG.ignoredPathsRegexString),
        MAX_RECURSION_DEPTH: configFileConfig.MAX_RECURSION_DEPTH || DEFAULT_CONFIG.MAX_RECURSION_DEPTH,
    };

    // Logik für storiesDir (CLI-Arg hat Vorrang, dann dynamische Ermittlung)
    if (argv.storiesDir) { // Wenn explizit per CLI gesetzt
        config.storiesDir = path.resolve(CWD, argv.storiesDir);
        if (!fs.existsSync(config.storiesDir)) {
            fs.mkdirSync(config.storiesDir, { recursive: true });
        }
    } else if (configFileConfig.storiesDir) { // Wenn in Config-Datei gesetzt (und nicht per CLI überschrieben)
        config.storiesDir = path.resolve(CWD, configFileConfig.storiesDir);
        if (!fs.existsSync(config.storiesDir)) {
            fs.mkdirSync(config.storiesDir, { recursive: true });
        }
    } else { // Weder CLI noch Config-Datei: dynamische Ermittlung
        const srcDir = path.join(CWD, 'src');
        const potentialSrcStoriesDir = path.join(srcDir, 'stories');
        const potentialRootStoriesDir = path.join(CWD, 'stories');

        if (fs.existsSync(srcDir)) {
            config.storiesDir = potentialSrcStoriesDir;
            if (!fs.existsSync(config.storiesDir)) fs.mkdirSync(config.storiesDir, { recursive: true });
        } else {
            config.storiesDir = potentialRootStoriesDir;
            if (!fs.existsSync(config.storiesDir)) fs.mkdirSync(config.storiesDir, { recursive: true });
        }
    }
    return config;
}

module.exports = getConfig();