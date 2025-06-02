// storybook-path-watcher/lib/story-writer.js
const fs = require('fs');
const path = require('path');
const babelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const chalk = require('chalk');
const ts = require('typescript');

// getStorybookTypeName bleibt wie im vorherigen korrekten Schritt
function getStorybookTypeName(tsType, typeChecker) {
    if (tsType.flags & ts.TypeFlags.Boolean) return 'boolean';
    if (tsType.flags & ts.TypeFlags.Number) return 'number';
    if (tsType.flags & ts.TypeFlags.String) return 'string';
    if (typeChecker.isArrayType(tsType)) return 'array';
    if (tsType.getCallSignatures().length > 0) return 'function';
    if (tsType.isUnion() && tsType.types.every(t => t.flags & ts.TypeFlags.StringLiteral)) return 'enum';
    if (tsType.isClassOrInterface() || (tsType.flags & ts.TypeFlags.Object && typeChecker.typeToString(tsType) !== 'React.ReactNode' && typeChecker.typeToString(tsType) !== 'React.ReactElement')) return 'object';
    return 'other';
}

// KORRIGIERTE SIGNATUR: generateArgTypesFlag als Parameter hinzugefügt
function createStoryFileContent(componentName, componentImportPath, storyTitlePath, defaultStoryName, generateArgTypesFlag) {
    let storyTitle;
    if (!storyTitlePath || storyTitlePath === '.' || storyTitlePath === '') {
        storyTitle = componentName;
    } else {
        storyTitle = `${storyTitlePath}/${componentName}`;
    }

    // generateArgTypesFlag wird jetzt hier korrekt referenziert
    const argTypesSection = generateArgTypesFlag ? `
  argTypes: {
    // Hier werden die argTypes eingefügt (oder bleiben leer, wenn updateStoryFile sie befüllt)
  },` : '';

    return `import type { Meta, StoryObj } from "@storybook/react";
import ${componentName} from "${componentImportPath}";

const meta: Meta<typeof ${componentName}> = {
  title: "${storyTitle}",
  component: ${componentName},
  tags: ["autodocs"],
  parameters: {},${argTypesSection}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ${defaultStoryName}: Story = {
  args: {},
};
`;
}

// getTypeInfoForStorybook bleibt wie im vorherigen korrekten Schritt
function getTypeInfoForStorybook(tsType, typeChecker) {
    let storybookTypeName = 'other';
    let controlType = 'object'; // Allgemeiner Fallback für Control
    let options = null; // Wird für 'select' oder 'radio' Controls relevant

    if (tsType.flags & ts.TypeFlags.Boolean) {
        storybookTypeName = 'boolean';
        controlType = 'boolean';
    } else if (tsType.flags & ts.TypeFlags.Number) {
        storybookTypeName = 'number';
        controlType = 'number';
    } else if (tsType.flags & ts.TypeFlags.String) {
        storybookTypeName = 'string';
        controlType = 'text';
    } else if (typeChecker.isArrayType(tsType)) {
        storybookTypeName = 'array';
        controlType = 'object';
    } else if (tsType.getCallSignatures().length > 0) {
        storybookTypeName = 'function';
        controlType = undefined; // Explizit undefined, da 'action' in args gehandhabt wird
    } else if (tsType.isUnion() && tsType.types.every(t => t.flags & ts.TypeFlags.StringLiteral)) {
        // Dies ist ein String-Literal Union type (z.B. 'a' | 'b')
        storybookTypeName = 'string'; // Storybook behandelt dies oft als String mit Optionen
        controlType = 'select';
        // typeChecker.typeToString(t) gibt den String-Literal-Wert inklusive Anführungszeichen zurück (z.B. "'primary'")
        // Das ist korrekt für die `options`-Liste in Storybook, wenn die Werte Strings sind.
        options = tsType.types.map(t => typeChecker.typeToString(t));
    } else if (tsType.isUnion() && tsType.types.every(t => t.flags & ts.TypeFlags.NumberLiteral)) {
        // Für Number-Literal Union types (z.B. 1 | 2 | 3)
        storybookTypeName = 'number';
        controlType = 'select'; // Oder 'radio'
        options = tsType.types.map(t => typeChecker.typeToString(t)); // Gibt die Zahlen als Strings zurück (z.B. "1", "2")
    }
    // TODO: Enum-Typen explizit behandeln (ts.SymbolFlags.EnumMember oder ts.SymbolFlags.Enum)
    // Dies erfordert eine andere Logik, um die Enum-Member-Namen und -Werte zu extrahieren.
    // Fürs Erste verlassen wir uns auf die String/Number-Literal-Union-Erkennung.
    else if (tsType.isClassOrInterface() || (tsType.flags & ts.TypeFlags.Object && typeChecker.typeToString(tsType) !== 'React.ReactNode' && typeChecker.typeToString(tsType) !== 'React.ReactElement')) {
        storybookTypeName = 'object';
        controlType = 'object';
    } else if (typeChecker.typeToString(tsType) === 'React.ReactNode' || typeChecker.typeToString(tsType) === 'React.ReactElement') {
        storybookTypeName = 'other';
        controlType = 'object';
    }

    const controlString = controlType ? `'${controlType}'` : 'undefined';
    return { storybookTypeName, controlString, options };
}

// updateStoryFile bleibt wie im vorherigen korrekten Schritt (mit config Parameter)
async function updateStoryFile(storyFilePath, extractedProps, defaultStoryName, CWD, typeChecker, config) {
    console.log(chalk.blue(`Aktualisiere Meta und Args in Story: ${chalk.underline.white(path.relative(CWD, storyFilePath))}`));
    try {
        const storyFileContent = fs.readFileSync(storyFilePath, 'utf-8');
        const ast = babelParser.parse(storyFileContent, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

        let metaUpdated = false;

        traverse(ast, {
            VariableDeclarator(pathNode) {
                if (pathNode.node.id && pathNode.node.id.name === 'meta') {
                    if (pathNode.node.init && pathNode.node.init.type === 'ObjectExpression') {
                        if (config.generateArgTypes) {
                            let argTypesProperty = pathNode.node.init.properties.find(
                                p => p.type === 'ObjectProperty' && p.key.name === 'argTypes'
                            );

                            if (!argTypesProperty) {
                                const newArgTypesObjectAST = babelParser.parseExpression("({ argTypes: {} })").properties[0];
                                pathNode.node.init.properties.push(newArgTypesObjectAST);
                                argTypesProperty = newArgTypesObjectAST;
                            }

                            if (argTypesProperty && argTypesProperty.value.type === 'ObjectExpression') {
                                const newArgTypeProperties = [];
                                for (const prop of extractedProps) {
                                    let typeInfo, controlOutput;

                                    if (!typeChecker) {
                                        console.warn(chalk.yellow(`TypeChecker fehlt für Prop '${prop.name}', ArgType-Generierung ist vereinfacht.`));
                                        typeInfo = { storybookTypeName: 'other', controlString: "'object'", options: null };
                                    } else {
                                        typeInfo = getTypeInfoForStorybook(prop.type, typeChecker);
                                    }

                                    if (typeInfo.options && (typeInfo.controlString === "'select'" || typeInfo.controlString === "'radio'")) {
                                        // Die Optionen sind bereits Strings mit Anführungszeichen (z.B. "'primary'"),
                                        // oder Zahlen als Strings (z.B. "1", "2"). Für das Array in JS brauchen wir sie als Literale.
                                        // Wenn typeChecker.typeToString(t) z.B. "'primary'" zurückgibt, ist das schon korrekt für die Aufnahme in den String.
                                        // Wenn es eine Zahl ist, z.B. "1", ist das auch okay, da es als JS-Zahl im Array geparst wird.
                                        const optionsArrayString = `[${typeInfo.options.join(', ')}]`;
                                        controlOutput = `control: { type: ${typeInfo.controlString}, options: ${optionsArrayString} }`;
                                    } else {
                                        controlOutput = `control: ${typeInfo.controlString}`;
                                    }

                                    let argTypeEntryString = `{
                                        name: '${prop.name}',
                                        type: { name: '${typeInfo.storybookTypeName}', required: ${!prop.isOptional} },`;
                                    if (prop.description) {
                                        argTypeEntryString += `
                                        description: '${prop.description.replace(/'/g, "\\'").replace(/\n/g, '\\n')}',`;
                                    }
                                    argTypeEntryString += `
                                        ${controlOutput},
                                        table: {
                                            type: { summary: '${typeChecker ? typeChecker.typeToString(prop.type).replace(/'/g, "\\'") : 'unknown'}' },
                                            defaultValue: { summary: '${prop.defaultValueString.replace(/'/g, "\\'").replace(/\n/g, ' ')}' },
                                        },
                                    }`;

                                    try {
                                        const valueNode = babelParser.parseExpression(argTypeEntryString);
                                        newArgTypeProperties.push(
                                            { type: "ObjectProperty", key: { type: "Identifier", name: prop.name }, value: valueNode }
                                        );
                                    } catch (e) {
                                        console.warn(chalk.yellow(`Konnte argType für Prop '${prop.name}' nicht als Expression parsen: ${e.message}. ArgTypeString war: ${argTypeEntryString}`));
                                    }
                                }
                                argTypesProperty.value.properties = newArgTypeProperties;
                                metaUpdated = true;
                            }
                        } else {
                            const argTypesIndex = pathNode.node.init.properties.findIndex(
                                p => p.type === 'ObjectProperty' && p.key.name === 'argTypes'
                            );
                            if (argTypesIndex > -1) {
                                pathNode.node.init.properties.splice(argTypesIndex, 1);
                                metaUpdated = true;
                                console.log(chalk.blue(`argTypes-Feld entfernt für ${path.relative(CWD, storyFilePath)}, da generateArgTypes=false.`));
                            }
                        }
                    }
                }

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
                                    valueNode = babelParser.parseExpression(prop.defaultValueString);
                                } catch (e) {
                                    console.warn(chalk.yellow(`Konnte Default-Wert für Prop '${prop.name}' nicht als Expression parsen: ${prop.defaultValueString}. Fallback zu 'undefined'.`));
                                    valueNode = { type: "Identifier", name: "undefined" };
                                    valueNode.trailingComments = [{ type: "CommentLine", value: ` TODO: Default value "${prop.defaultValueString}" couldn't be parsed. ` }];
                                }
                                return { type: "ObjectProperty", key: { type: "Identifier", name: prop.name }, value: valueNode, shorthand: false, computed: false };
                            });
                            argsProperty.value.properties = newArgsProperties;
                            metaUpdated = true;
                        }
                    }
                }
            }
        });

        if (metaUpdated) {
            const output = generator(ast, { retainLines: true, comments: true }, storyFileContent);
            fs.writeFileSync(storyFilePath, output.code);
            console.log(chalk.green(`Meta (Args/ArgTypes) in ${chalk.underline.white(path.relative(CWD, storyFilePath))} erfolgreich aktualisiert.`));
            await formatFileWithPrettier(storyFilePath, CWD); // CWD ist hier der projectRoot

        } else {
            console.warn(chalk.yellow(`Konnte Args/ArgTypes in ${chalk.underline.white(path.relative(CWD, storyFilePath))} nicht finden oder es gab nichts zu aktualisieren.`));
        }
    } catch (error) {
        console.error(chalk.red(`Fehler beim Aktualisieren der Meta in ${chalk.underline.white(path.relative(CWD, storyFilePath))}:`), error);
    }
}


module.exports = {
    createStoryFileContent,
    updateStoryFile,
};