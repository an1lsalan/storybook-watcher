// In lib/story-writer.js oder einer neuen lib/formatter.js
const prettier = require('prettier');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

async function formatFileWithPrettier(filePath, projectRoot) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const prettierConfig = await prettier.resolveConfig(projectRoot, { editorconfig: true });

        const formattedContent = await prettier.format(fileContent, {
            ...prettierConfig,
            filepath: filePath,
        });

        if (formattedContent !== fileContent) {
            fs.writeFileSync(filePath, formattedContent, 'utf8');
            console.log(chalk.blueBright(`Datei formatiert mit Prettier: ${chalk.underline.white(path.relative(projectRoot, filePath))}`));
        }
    } catch (error) {
        console.warn(chalk.yellow(`Konnte Datei nicht mit Prettier formatieren: ${path.relative(projectRoot, filePath)}. Fehler: ${error.message}`));
    }
}

module.exports = { formatFileWithPrettier };
