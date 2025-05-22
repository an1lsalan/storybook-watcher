// storybook-path-watcher/lib/story-writer.js
const fs = require('fs');
const path = require('path'); // path wird hier für path.relative benötigt
const babelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const chalk = require('chalk');
const ts = require('typescript');

function createStoryFileContent(componentName, componentImportPath, storyTitlePath, defaultStoryName) {
    let storyTitle;
    // ... (Logik für storyTitle bleibt gleich)
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
  argTypes: { // Leeres argTypes-Objekt als Platzhalter
    // Hier werden die argTypes eingefügt
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ${defaultStoryName}: Story = {
  args: {}, // Args bleiben initial leer, werden von updateStoryArgsInFile befüllt
};
`;
}

function getControlType(tsType, typeChecker) {
    if (tsType.flags & ts.TypeFlags.Boolean) return "'boolean'";
    if (tsType.flags & ts.TypeFlags.Number) return "'number'";
    if (tsType.flags & ts.TypeFlags.String) return "'text'";
    if (tsType.flags & ts.TypeFlags.Enum) return "'select'";
    if (tsType.flags & ts.TypeFlags.Object) {
        const symbol = typeChecker.getPropertyOfType(tsType, 'type');
        if (symbol) {
            const type = typeChecker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
            if (type.flags & ts.TypeFlags.StringLiteral) return "'text'";
            if (type.flags & ts.TypeFlags.NumberLiteral) return "'number'";
            if (type.flags & ts.TypeFlags.BooleanLiteral) return "'boolean'";
        }
    }
    if (tsType.flags & ts.TypeFlags.Array) {
        const elementType = typeChecker.getTypeArguments(tsType.getProperties().find(p => p.name === 'length')?.valueDeclaration);
        if (elementType) {
            return getControlType(elementType[0], typeChecker);
        }
    }
    if (tsType.flags & ts.TypeFlags.Function) return "'function'";
    if (tsType.flags & ts.TypeFlags.Undefined) return "undefined";
    if (tsType.flags & ts.TypeFlags.Null) return "null";
    if (tsType.flags & ts.TypeFlags.Any) return "'any'";
    if (tsType.flags & ts.TypeFlags.Unknown) return "'unknown'";
    if (tsType.flags & ts.TypeFlags.Never) return "'never'";
    if (tsType.flags & ts.TypeFlags.Intrinsic) {
        const intrinsicName = tsType.intrinsicName;
        if (intrinsicName === 'string') return "'text'";
        if (intrinsicName === 'number') return "'number'";
        if (intrinsicName === 'boolean') return "'boolean'";
        if (intrinsicName === 'object') return "'object'";
    }
    if (tsType.flags & ts.TypeFlags.TypeParameter) {
        const typeParam = tsType.getProperties().find(p => p.name === 'type');
        if (typeParam) {
            const type = typeChecker.getTypeOfSymbolAtLocation(typeParam, typeParam.valueDeclaration);
            return getControlType(type, typeChecker);
        }
    }
    if (tsType.flags & ts.TypeFlags.Mapped) {
        const mappedType = tsType.getProperties().find(p => p.name === 'type');
        if (mappedType) {
            const type = typeChecker.getTypeOfSymbolAtLocation(mappedType, mappedType.valueDeclaration);
            return getControlType(type, typeChecker);
        }
    }
    if (tsType.flags & ts.TypeFlags.Conditional) {
        const conditionalType = tsType.getProperties().find(p => p.name === 'type');
        if (conditionalType) {
            const type = typeChecker.getTypeOfSymbolAtLocation(conditionalType, conditionalType.valueDeclaration);
            return getControlType(type, typeChecker);
        }
    }
    if (tsType.flags & ts.TypeFlags.Union) {
        const unionTypes = tsType.types.map(t => getControlType(t, typeChecker));
        return `oneOf([${unionTypes.join(', ')}])`;
    }
    if (tsType.flags & ts.TypeFlags.Intersection) {
        const intersectionTypes = tsType.types.map(t => getControlType(t, typeChecker));
        return `intersection([${intersectionTypes.join(', ')}])`;
    }
    return "undefined"; // Kein spezifischer Control-Typ bekannt
}

function updateStoryFile(storyFilePath, extractedProps, defaultStoryName, CWD, typeChecker) { // typeChecker hinzugefügt
    console.log(chalk.blue(`Aktualisiere Meta und Args in Story: ${chalk.underline.white(path.relative(CWD, storyFilePath))}`));
    try {
        const storyFileContent = fs.readFileSync(storyFilePath, 'utf-8');
        const ast = babelParser.parse(storyFileContent, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

        let metaUpdated = false;

        traverse(ast, {
            VariableDeclarator(pathNode) {
                if (pathNode.node.id && pathNode.node.id.name === 'meta') { // Finde das 'meta' Objekt
                    if (pathNode.node.init && pathNode.node.init.type === 'ObjectExpression') {
                        let argTypesProperty = pathNode.node.init.properties.find(
                            p => p.type === 'ObjectProperty' && p.key.name === 'argTypes'
                        );

                        if (!argTypesProperty) { // Falls 'argTypes' nicht existiert, füge es hinzu
                            const newArgTypesObjectAST = babelParser.parseExpression("({ argTypes: {} })").properties[0];
                            pathNode.node.init.properties.push(newArgTypesObjectAST);
                            argTypesProperty = newArgTypesObjectAST;
                        }

                        if (argTypesProperty && argTypesProperty.value.type === 'ObjectExpression') {
                            const newArgTypeProperties = [];
                            for (const prop of extractedProps) {
                                if (!typeChecker) {
                                    console.warn(chalk.yellow(`TypeChecker fehlt für Prop '${prop.name}', ArgType-Generierung könnte unvollständig sein.`));

                                    const controlType = getControlType(prop.type, typeChecker); // prop.type ist der ts.Type
                                    const typeSummary = typeChecker.typeToString(prop.type);
                                } else {
                                    const controlType = getControlType(prop.type, typeChecker);
                                    const typeSummary = typeChecker.typeToString(prop.type);
                                }

                                let argTypeEntryString = `{
                                    name: '${prop.name}',
                                    type: { name: '${typeSummary.replace(/'/g, "\\'")}', required: ${!prop.isOptional} },`;
                                if (prop.description) {
                                    argTypeEntryString += `
                                    description: '${prop.description.replace(/'/g, "\\'").replace(/\n/g, '\\n')}',`;
                                }
                                argTypeEntryString += `
                                    control: ${controlType},
                                    table: {
                                        type: { summary: '${typeSummary.replace(/'/g, "\\'")}' },
                                        defaultValue: { summary: '${prop.defaultValueString.replace(/'/g, "\\'").replace(/\n/g, ' ')}' },
                                    },
                                }`;

                                try {
                                    const valueNode = babelParser.parseExpression(argTypeEntryString);
                                    newArgTypeProperties.push(
                                        { type: "ObjectProperty", key: { type: "Identifier", name: prop.name }, value: valueNode }
                                    );
                                } catch (e) {
                                    console.warn(chalk.yellow(`Konnte argType für Prop '${prop.name}' nicht als Expression parsen: ${e.message}`));
                                }
                            }
                            argTypesProperty.value.properties = newArgTypeProperties;
                            metaUpdated = true;
                        }
                    }
                }

                if (pathNode.node.id && pathNode.node.id.name === defaultStoryName) { // Update Args wie zuvor
                    if (pathNode.node.init && pathNode.node.init.type === 'ObjectExpression') {
                        let argsProperty = pathNode.node.init.properties.find(p => p.type === 'ObjectProperty' && p.key.name === 'args');
                        if (!argsProperty) { /* ... argsProperty erstellen ... */
                            const newArgsObject = babelParser.parseExpression("({ args: {} })").properties[0];
                            pathNode.node.init.properties.push(newArgsObject);
                            argsProperty = newArgsObject;
                        }
                        if (argsProperty && argsProperty.value.type === 'ObjectExpression') {
                            const newArgsProperties = extractedProps.map(prop => {
                                let valueNode;
                                try {
                                    valueNode = babelParser.parseExpression(prop.defaultValueString);
                                } catch (e) { /* ... Fehlerbehandlung ... */
                                    console.warn(chalk.yellow(`Konnte Default-Wert für Prop '${prop.name}' nicht als Expression parsen: ${prop.defaultValueString}. Fallback zu 'undefined'.`));
                                    valueNode = { type: "Identifier", name: "undefined" };
                                    valueNode.trailingComments = [{ type: "CommentLine", value: ` TODO: Default value "${prop.defaultValueString}" couldn't be parsed. ` }];
                                }
                                return { type: "ObjectProperty", key: { type: "Identifier", name: prop.name }, value: valueNode, shorthand: false, computed: false };
                            });
                            argsProperty.value.properties = newArgsProperties;
                            metaUpdated = true; // Wird gesetzt, wenn args oder argTypes aktualisiert wurden
                        }
                    }
                }
            }
        });

        if (metaUpdated) { // Umbenannt von storyArgsUpdated
            const output = generator(ast, { retainLines: true }, storyFileContent);
            fs.writeFileSync(storyFilePath, output.code);
            console.log(chalk.green(`Meta (Args/ArgTypes) in ${chalk.underline.white(path.relative(CWD, storyFilePath))} erfolgreich aktualisiert.`));
        } else {
            console.warn(chalk.yellow(`Konnte Args/ArgTypes in ${chalk.underline.white(path.relative(CWD, storyFilePath))} nicht finden oder es gab nichts zu aktualisieren.`));
        }
    } catch (error) {
        console.error(chalk.red(`Fehler beim Aktualisieren der Meta in ${chalk.underline.white(path.relative(CWD, storyFilePath))}:`), error);
    }
}


module.exports = {
    createStoryFileContent,
    // updateStoryArgsInFile wurde zu updateStoryFile umbenannt, um die erweiterte Funktionalität widerzuspiegeln
    updateStoryFile,
};