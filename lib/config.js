
const path = require('path');
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');

const CWD = process.cwd();

function getConfig() {
    const argv = yargs(hideBin(process.argv))
        .option('componentsDir', {
            alias: 'c', type: 'string', default: path.join('src', 'components'),
            description: 'Pfad zum Komponentenverzeichnis (relativ zu CWD)',
        })
        .option('storiesDir', {
            alias: 's', type: 'string', default: null,
            description: 'Pfad zum Stories-Verzeichnis (relativ zu CWD). Wenn nicht gesetzt, wird dynamisch ermittelt.',
        })
        .option('componentExts', {
            alias: 'e', type: 'string', default: '.tsx,.jsx',
            description: 'Komma-separierte Liste von Dateiendungen für Komponenten',
        })
        .option('storyExt', {
            alias: 'x', type: 'string', default: '.stories.tsx',
            description: 'Dateiendung für generierte Story-Dateien',
        })
        .option('defaultStoryName', {
            alias: 'n', type: 'string', default: 'Default',
            description: 'Name des Standard-Story-Exports',
        })
        .help().alias('help', 'h')
        .argv;

    const config = {
        CWD,
        componentsDir: path.resolve(CWD, argv.componentsDir),
        componentFileExtensions: argv.componentExts.split(',').map(ext => ext.trim()),
        storyFileExtension: argv.storyExt,
        defaultStoryName: argv.defaultStoryName,
        ignoredPathsRegex: /(\.(test|spec)\.(ts|tsx|js|jsx)$)|(\/(node_modules|\.next|\.storybook)\/)/, // Vorerst hier, später ggf. konfigurierbar
        MAX_RECURSION_DEPTH: 2, // Vorerst hier
    };

    // Logik für storiesDir
    if (argv.storiesDir) {
        config.storiesDir = path.resolve(CWD, argv.storiesDir);
        // console.log(chalk.blue(`Nutze explizit gesetztes Story-Verzeichnis: ${chalk.yellow(path.relative(CWD, config.storiesDir))}`)); // Loggen im Hauptskript
        if (!fs.existsSync(config.storiesDir)) {
            fs.mkdirSync(config.storiesDir, { recursive: true });
            // console.log(chalk.blue(`Erstelle explizit gesetztes Story-Verzeichnis: ${chalk.yellow(path.relative(CWD, config.storiesDir))}`));
        }
    } else {
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

module.exports = getConfig(); // Exportiere das Ergebnis des Funktionsaufrufs