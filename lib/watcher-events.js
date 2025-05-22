// storybook-path-watcher/lib/watcher-events.js
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { ensureDirectoryExistence, getStoryFilePath } = require('./file-system');
const { getComponentNameFromPath, getComponentImportPath, extractPropsFromComponent } = require('./component-analyzer');
const { createStoryFileContent, updateStoryArgsInFile } = require('./story-writer');

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
    const extractedProps = extractPropsFromComponent(componentPath, config.CWD, config.MAX_RECURSION_DEPTH);

    const relativePathForTitle = path.dirname(path.relative(config.componentsDir, componentPath));
    const storyTitleDirectory = (relativePathForTitle === '.' || relativePathForTitle === '') ? '' : relativePathForTitle.replace(/\\/g, '/');

    const storyContent = createStoryFileContent(componentName, componentImportPath, storyTitleDirectory, config.defaultStoryName);

    ensureDirectoryExistence(storyFilePath);
    fs.writeFileSync(storyFilePath, storyContent);
    console.log(chalk.green(`Story erstellt: ${chalk.underline.white(path.relative(config.CWD, storyFilePath))}`));

    if (extractedProps && extractedProps.length > 0) {
        updateStoryArgsInFile(storyFilePath, extractedProps, config.defaultStoryName, config.CWD); // <--- Alle Parameter
    } else {
        console.log(chalk.gray(`Keine Props für ${componentName} extrahiert, Args bleiben initial leer.`));
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

    const extractedProps = extractPropsFromComponent(componentPath, config.CWD, config.MAX_RECURSION_DEPTH);
    if (extractedProps && extractedProps.length > 0) {
        updateStoryArgsInFile(storyFilePath, extractedProps, config.defaultStoryName, config.CWD); // <--- Alle Parameter
    } else {
        if (!isUpdateCallFromNew) console.log(chalk.gray(`Keine Props für ${chalk.underline.white(path.relative(config.CWD, componentPath))} extrahiert...`));
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