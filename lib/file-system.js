// storybook-path-watcher/lib/file-system.js
const fs = require('fs');
const path = require('path');

function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) { return true; }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

// Benötigt config-Objekt für storiesDir, componentsDir, storyFileExtension
function getStoryFilePath(componentPath, config) {
    const relativeFromComponentsDir = path.relative(config.componentsDir, componentPath);
    let storyPath = path.join(config.storiesDir, relativeFromComponentsDir);
    storyPath = storyPath.replace(path.extname(storyPath), config.storyFileExtension);
    const componentFileNameWithoutExt = path.basename(componentPath, path.extname(componentPath));
    if (componentFileNameWithoutExt.toLowerCase() === 'index') {
        storyPath = path.join(path.dirname(storyPath), `index${config.storyFileExtension}`);
    }
    return storyPath;
}

module.exports = {
    ensureDirectoryExistence,
    getStoryFilePath,
};