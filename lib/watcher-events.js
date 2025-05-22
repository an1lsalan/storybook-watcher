// storybook-path-watcher/lib/watcher-events.js
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { ensureDirectoryExistence, getStoryFilePath } = require('./file-system');
const { getComponentNameFromPath, getComponentImportPath, extractPropsFromComponent } = require('./component-analyzer');
const { createStoryFileContent, updateStoryFile } = require('./story-writer');


let isUpdateCallFromNew = false; // Lokales Flag für dieses Modul

// Alle Handler benötigen das `config`-Objekt
function handleNewComponent(componentPath, config) {
    console.log(chalk.greenBright(`Neue Komponente erkannt: ${chalk.underline.white(path.relative(config.CWD, componentPath))}`));
    const storyFilePath = getStoryFilePath(componentPath, config);


    if (fs.existsSync(storyFilePath)) {
        console.log(chalk.blue(`Story existiert bereits: ${chalk.underline.white(path.relative(config.CWD, storyFilePath))}. Versuche Args zu aktualisieren.`));
        isUpdateCallFromNew = true;
        handleChangeComponent(componentPath, config);
        isUpdateCallFromNew = false;
        return;
    }

    const componentName = getComponentNameFromPath(componentPath, config.componentsDir);
    const componentImportPath = getComponentImportPath(componentPath, config.CWD);
    const { extractedProps, typeChecker } = extractPropsFromComponent(componentPath, config.CWD, config.MAX_RECURSION_DEPTH);

    const relativePathForTitle = path.dirname(path.relative(config.componentsDir, componentPath));
    const storyTitleDirectory = (relativePathForTitle === '.' || relativePathForTitle === '') ? '' : relativePathForTitle.replace(/\\/g, '/');

    const storyContent = createStoryFileContent(componentName, componentImportPath, storyTitleDirectory, config.defaultStoryName, config.generateArgTypes); // config.generateArgTypes übergeben

    ensureDirectoryExistence(storyFilePath);
    fs.writeFileSync(storyFilePath, storyContent);
    console.log(chalk.green(`Story erstellt: ${chalk.underline.white(path.relative(config.CWD, storyFilePath))}`));

    if (extractedProps && extractedProps.length > 0 && typeChecker) { // Stelle sicher, dass typeChecker existiert
        updateStoryFile(storyFilePath, extractedProps, config.defaultStoryName, config.CWD, typeChecker, config); // config übergeben
    } else if (!typeChecker && extractedProps && extractedProps.length > 0) {
        console.warn(chalk.yellow(`Konnte TypeChecker nicht initialisieren für ${componentPath}, ArgTypes werden möglicherweise nicht vollständig sein.`));
        // Optional: updateStoryFile nur mit Props aufrufen, wenn typeChecker fehlt und updateStoryFile das handhaben kann
    } else {
        console.log(chalk.gray(`Keine Props für ${getComponentNameFromPath(componentPath, config.componentsDir)} extrahiert oder TypeChecker fehlt, Args/ArgTypes bleiben initial oder werden nicht aktualisiert.`));
    }
}

function handleChangeComponent(componentPath, config) {
    if (!isUpdateCallFromNew) console.log(chalk.yellowBright(`Komponente geändert: ${chalk.underline.white(path.relative(config.CWD, componentPath))}`));
    const storyFilePath = getStoryFilePath(componentPath, config);

    if (!fs.existsSync(storyFilePath)) {
        console.log(chalk.blue(`Zugehörige Story für ${chalk.underline.white(path.relative(config.CWD, componentPath))} nicht gefunden. Erstelle neu...`));
        handleNewComponent(componentPath, config);
        return;
    }

    const { extractedProps, typeChecker } = extractPropsFromComponent(componentPath, config.CWD, config.MAX_RECURSION_DEPTH);
    if (extractedProps && extractedProps.length > 0 && typeChecker) { // Stelle sicher, dass typeChecker existiert
        updateStoryFile(storyFilePath, extractedProps, config.defaultStoryName, config.CWD, typeChecker, config); // config übergeben
    } else if (!typeChecker && extractedProps && extractedProps.length > 0) {
        console.warn(chalk.yellow(`Konnte TypeChecker nicht initialisieren für ${componentPath} bei Änderung, ArgTypes werden möglicherweise nicht vollständig sein.`));
    } else {
        if (!isUpdateCallFromNew) console.log(chalk.gray(`Keine Props für ${chalk.underline.white(path.relative(config.CWD, componentPath))} extrahiert oder TypeChecker fehlt...`));
    }
}

function handleDeleteComponent(componentPath, config) {
    console.log(chalk.redBright(`Komponente gelöscht: ${chalk.underline.white(path.relative(config.CWD, componentPath))}`));
    const storyFilePath = getStoryFilePath(componentPath, config);

    if (fs.existsSync(storyFilePath)) {
        fs.unlinkSync(storyFilePath);
        console.log(chalk.red(`Story gelöscht: ${chalk.underline.white(path.relative(config.CWD, storyFilePath))}`));
    } else {
        console.log(chalk.gray(`Keine zugehörige Story für ${chalk.underline.white(path.relative(config.CWD, componentPath))} zum Löschen gefunden.`));
    }
}

module.exports = {
    handleNewComponent,
    handleChangeComponent,
    handleDeleteComponent,
};