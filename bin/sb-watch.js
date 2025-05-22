#!/usr/bin/env node

const fs = require('fs'); // Wird hier ggf. noch für die Prüfung des componentsDir benötigt
const path = require('path'); // Wird hier ggf. noch für die Prüfung des componentsDir benötigt
const chokidar = require('chokidar');
const chalk = require('chalk');
const config = require('../lib/config'); // Lade die Konfiguration
const watcherEventHandlers = require('../lib/watcher-events');

// Log Startmeldungen basierend auf der geladenen Konfiguration
console.log(chalk.bold.green('Storybook Path Watcher gestartet...'));
if (config.storiesDir === path.join(config.CWD, 'src', 'stories')) {
    console.log(chalk.blue(`Nutze Story-Verzeichnis in src: ${chalk.yellow(path.relative(config.CWD, config.storiesDir))}`));
} else if (config.storiesDir === path.join(config.CWD, 'stories')) {
    console.log(chalk.blue(`Nutze Story-Verzeichnis im Root: ${chalk.yellow(path.relative(config.CWD, config.storiesDir))}`));
} else {
    console.log(chalk.blue(`Nutze explizit gesetztes Story-Verzeichnis: ${chalk.yellow(path.relative(config.CWD, config.storiesDir))}`));
}

console.log(chalk.cyan(`Überwache Komponenten in: ${chalk.yellow(path.relative(config.CWD, config.componentsDir))}`));
console.log(chalk.cyan(`Stories werden in: ${chalk.yellow(path.relative(config.CWD, config.storiesDir))} verwaltet`));
console.log(chalk.cyan(`Komponenten-Endungen: ${chalk.yellow(config.componentFileExtensions.join(', '))}`));
console.log(chalk.cyan(`Story-Endung: ${chalk.yellow(config.storyFileExtension)}`));
console.log(chalk.cyan(`Standard Story-Name: ${chalk.yellow(config.defaultStoryName)}`));
console.log(chalk.gray('Nutze `sb-watch --help` für alle Optionen.'));


if (!fs.existsSync(config.componentsDir)) {
    console.error(chalk.red.bold(`Fehler: Komponentenverzeichnis nicht gefunden: ${path.relative(config.CWD, config.componentsDir)}`));
    console.error(chalk.red.bold(`Stelle sicher, dass das Verzeichnis existiert oder passe die --componentsDir Option an.`));
    process.exit(1);
}

const watcher = chokidar.watch(config.componentsDir, {
    ignored: (pathString) => {
        if (pathString.startsWith(config.storiesDir)) return true;
        return config.ignoredPathsRegex.test(pathString);
    },
    persistent: true, ignoreInitial: true, atomic: true,
    awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 }
});

watcher
    .on('add', filePath => {
        if (config.componentFileExtensions.includes(path.extname(filePath).toLowerCase())) {
            watcherEventHandlers.handleNewComponent(filePath, config);
        }
    })
    .on('change', filePath => {
        if (config.componentFileExtensions.includes(path.extname(filePath).toLowerCase())) {
            watcherEventHandlers.handleChangeComponent(filePath, config);
        }
    })
    .on('unlink', filePath => {
        if (config.componentFileExtensions.includes(path.extname(filePath).toLowerCase())) {
            watcherEventHandlers.handleDeleteComponent(filePath, config);
        }
    })
    .on('error', error => console.error(chalk.red.bold(`Watcher Fehler: ${error}`)))
    .on('ready', () => console.log(chalk.bold.green('Initiale Prüfung abgeschlossen. Watcher ist bereit und überwacht Änderungen.')));