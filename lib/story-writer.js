// storybook-path-watcher/lib/story-writer.js
const fs = require('fs');
const path = require('path'); // path wird hier für path.relative benötigt
const babelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const chalk = require('chalk');

// createStoryFileContent bleibt wie zuvor...
function createStoryFileContent(componentName, componentImportPath, storyTitlePath, defaultStoryName) {
    let storyTitle;
    if (!storyTitlePath || storyTitlePath === '.' || storyTitlePath === '') {
        storyTitle = componentName;
    } else {
        storyTitle = `${storyTitlePath}/${componentName}`;
    }
    return `import type { Meta, StoryObj } from "@storybook/react";
import ${componentName} from "${componentImportPath}";

const meta: Meta<typeof ${componentName}> = {
  title: "${storyTitle}",
  component: ${componentName},
  tags: ["autodocs"],
  parameters: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ${defaultStoryName}: Story = {
  args: {},
};
`;
}


// KORRIGIERTE SIGNATUR UND VERWENDUNG VON CWD & defaultStoryName
function updateStoryArgsInFile(storyFilePath, extractedProps, defaultStoryName, CWD) { // <--- CWD und defaultStoryName hier hinzugefügt
    console.log(chalk.blue(`Aktualisiere Args in Story: ${chalk.underline.white(path.relative(CWD, storyFilePath))}`)); // <--- CWD wird hier verwendet
    try {
        const storyFileContent = fs.readFileSync(storyFilePath, 'utf-8');
        const ast = babelParser.parse(storyFileContent, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
        let storyArgsUpdated = false;

        traverse(ast, {
            VariableDeclarator(pathNode) {
                // Stelle sicher, dass defaultStoryName hier korrekt verwendet wird
                if (pathNode.node.id && pathNode.node.id.name === defaultStoryName) {
                    if (pathNode.node.init && pathNode.node.init.type === 'ObjectExpression') {
                        let argsProperty = pathNode.node.init.properties.find(p => p.type === 'ObjectProperty' && p.key.name === 'args');
                        if (!argsProperty) {
                            const newArgsObject = babelParser.parseExpression("({ args: {} })").properties[0];
                            pathNode.node.init.properties.push(newArgsObject);
                            argsProperty = newArgsObject;
                        }
                        if (argsProperty && argsProperty.value.type === 'ObjectExpression') {
                            const newArgsProperties = extractedProps.map(prop => {
                                let valueNode;
                                try {
                                    valueNode = babelParser.parseExpression(prop.defaultValue);
                                } catch (e) {
                                    console.warn(chalk.yellow(`Konnte Default-Wert für Prop '${prop.name}' nicht als Expression parsen: ${prop.defaultValue}. Fallback zu 'undefined'.`));
                                    valueNode = { type: "Identifier", name: "undefined" };
                                    valueNode.trailingComments = [{ type: "CommentLine", value: ` TODO: Default value "${prop.defaultValue}" couldn't be parsed. ` }];
                                }
                                return { type: "ObjectProperty", key: { type: "Identifier", name: prop.name }, value: valueNode, shorthand: false, computed: false };
                            });
                            argsProperty.value.properties = newArgsProperties;
                            storyArgsUpdated = true;
                            pathNode.stop();
                        }
                    }
                }
            }
        });

        if (storyArgsUpdated) {
            const output = generator(ast, { /* compact: false, retainLines: true */ }, storyFileContent);
            fs.writeFileSync(storyFilePath, output.code);
            // CWD wird hier verwendet
            console.log(chalk.green(`Args in ${chalk.underline.white(path.relative(CWD, storyFilePath))} erfolgreich aktualisiert.`));
        } else {
            // CWD wird hier verwendet
            console.warn(chalk.yellow(`Konnte '${defaultStoryName}.args' in ${chalk.underline.white(path.relative(CWD, storyFilePath))} nicht finden oder aktualisieren.`));
        }
    } catch (error) {
        // CWD wird hier verwendet
        console.error(chalk.red(`Fehler beim Aktualisieren der Args in ${chalk.underline.white(path.relative(CWD, storyFilePath))}:`), error);
    }
}

module.exports = {
    createStoryFileContent,
    updateStoryArgsInFile,
};