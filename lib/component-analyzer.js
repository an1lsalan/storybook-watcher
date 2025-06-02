// storybook-path-watcher/lib/component-analyzer.js
const path = require('path');
const ts = require('typescript');
const chalk = require('chalk'); // Importiere chalk, falls du hier loggen willst

function getComponentNameFromPath(filePath, baseDir) {
    const relativePath = path.relative(baseDir, filePath);
    const dirInComponents = path.dirname(relativePath);
    let componentName = path.basename(filePath, path.extname(filePath)); // << WICHTIG: Initialisierung!

    // Entferne gängige Suffixe wie .ui.component, .component oder .module
    componentName = componentName.replace(/\.(ui\.component|component|module)$/i, '');

    const parentDirName = path.basename(dirInComponents);
    if (componentName.toLowerCase() === 'index' && parentDirName && parentDirName !== '.' && parentDirName !== path.basename(baseDir)) {
        componentName = parentDirName;
    } else if (componentName.toLowerCase() === parentDirName.toLowerCase() && parentDirName && parentDirName !== '.') {
        componentName = parentDirName;
    }

    if (!componentName) {
        console.warn(chalk.yellow(`Konnte keinen validen Komponentennamen für ${filePath} extrahieren.`));
        return 'UnnamedComponent'; // Fallback
    }
    return componentName.charAt(0).toUpperCase() + componentName.slice(1);
}

// Benötigt CWD aus config
function getComponentImportPath(componentFilePath, CWD) {  /* ... (Logik leicht anpassen, um CWD zu nutzen) ... */
    const srcPathInProject = path.join(CWD, 'src');
    const relativeFromSrc = path.relative(srcPathInProject, componentFilePath);
    let importPath = `@/${relativeFromSrc.replace(/\\/g, '/').replace(/\.(tsx|jsx)$/, '')}`;
    if (path.basename(importPath).toLowerCase() === 'index') {
        importPath = path.dirname(importPath);
    }
    if (importPath.startsWith('@/../')) {
        const relativeFromCwd = path.relative(CWD, componentFilePath);
        importPath = `../${relativeFromCwd.replace(/\\/g, '/').replace(/\.(tsx|jsx)$/, '')}`;
        if (path.basename(importPath).toLowerCase() === 'index') {
            importPath = path.dirname(importPath);
        }
        // console.warn(chalk.yellow(`Komponente ${componentFilePath} scheint außerhalb von 'src/' zu liegen...`)); // Loggen im Hauptskript oder hier
    }
    return importPath;
}

// Benötigt MAX_RECURSION_DEPTH aus config
function generateComplexDefaultValue(type, typeChecker, MAX_RECURSION_DEPTH, propName, useStorybookActions, depth = 0) { /* ... unverändert ... */
    if (depth > MAX_RECURSION_DEPTH) {
        return "undefined /* Max recursion depth reached */";
    }
    const displayType = typeChecker.typeToString(type);
    if (type.flags & ts.TypeFlags.String || displayType === 'string') return "''";
    if (type.flags & ts.TypeFlags.Number || displayType === 'number') return "0";
    if (type.flags & ts.TypeFlags.Boolean || displayType === 'boolean') return "false";
    if (typeChecker.isArrayType(type)) {
        const elementType = typeChecker.getElementTypeOfArrayType(type);
        if (elementType) {
            const elementValue = generateComplexDefaultValue(elementType, typeChecker, MAX_RECURSION_DEPTH, depth + 1);
            return `[${elementValue}]`;
        }
        return "[]";
    }
    if (type.isClassOrInterface() || (type.flags & ts.TypeFlags.Object && type.getProperties().length > 0) || type.isIntersection()) {
        const properties = type.getProperties();
        if (properties.length > 0) {
            const propsString = properties
                .map(prop => {
                    const propName = prop.getName();
                    const propType = typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration || typeChecker.getSymbolTarget(type.symbol, true));
                    const propValue = generateComplexDefaultValue(propType, typeChecker, MAX_RECURSION_DEPTH, depth + 1);
                    return `  ${propName}: ${propValue}`;
                })
                .join(",\n");
            return `{\n${propsString}\n}`;
        }
    }
    if (type.getCallSignatures().length > 0) { // Für Funktionen
        if (useStorybookActions) {
            // Bereinige propName, falls er Sonderzeichen enthält, die in einem String-Literal problematisch wären
            const cleanPropName = propName.replace(/['"\\]/g, ''); // Einfache Bereinigung
            return `action('${cleanPropName}')`;
        }
        return "() => {}";
    }
    if (displayType.includes('=>') || displayType.startsWith('(')) return "() => {}";
    if (displayType === 'React.ReactNode' || displayType === 'React.ReactElement') {
        return "undefined /* ReactNode/Element placeholder */";
    }
    if (type.flags & ts.TypeFlags.Object) return "{}";
    return `undefined /* type: ${displayType} */`;
}

// Benötigt CWD und MAX_RECURSION_DEPTH aus config
function extractPropsFromComponent(componentPath, CWD, MAX_RECURSION_DEPTH, useStorybookActionsConfig) {
    const program = ts.createProgram([componentPath], {
        jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, allowJs: true,
        baseUrl: CWD, paths: { "@/*": ["src/*"] }
    });
    const sourceFile = program.getSourceFile(componentPath);
    const typeChecker = program.getTypeChecker();
    const extractedProps = [];
    if (!sourceFile) {
        console.warn(chalk.yellow(`Konnte Quelldatei nicht laden für: ${chalk.underline.white(componentPath)}`)); // chalk muss hier verfügbar sein
        return { extractedProps, typeChecker: null }; // Gib null für typeChecker zurück, wenn sourceFile nicht geladen werden kann
    }
    function getJSDocComment(symbol) {
        const comments = symbol.getDocumentationComment(typeChecker);
        if (comments && comments.length > 0) {
            return ts.displayPartsToString(comments);
        }
        // Fallback für JSDoc-Tags auf dem Parent, falls es eine TypeAliasDeclaration ist
        if (symbol.valueDeclaration && symbol.valueDeclaration.parent && ts.isTypeAliasDeclaration(symbol.valueDeclaration.parent)) {
            const parentComments = typeChecker.getSymbolAtLocation(symbol.valueDeclaration.parent.name)?.getDocumentationComment(typeChecker);
            if (parentComments && parentComments.length > 0) {
                return ts.displayPartsToString(parentComments);
            }
        }
        return undefined;
    }

    function visit(node) {
        if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name) {
            const nodeName = node.name.getText(sourceFile);
            const isExported = node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
            if (isExported && (nodeName.endsWith('Props') || nodeName.endsWith('Properties') || nodeName === 'Props')) {
                const type = typeChecker.getTypeAtLocation(node);
                type.getProperties().forEach(propSymbol => {
                    const propName = propSymbol.getName();
                    const propType = typeChecker.getTypeOfSymbolAtLocation(propSymbol, propSymbol.valueDeclaration || node);
                    const isOptional = (propSymbol.flags & ts.SymbolFlags.Optional) !== 0;
                    const description = getJSDocComment(propSymbol); // JSDoc Kommentar extrahieren

                    extractedProps.push({
                        name: propName,
                        type: propType, // Speichere den ts.Type direkt
                        defaultValueString: generateComplexDefaultValue(propType, typeChecker, MAX_RECURSION_DEPTH), // Generiere komplexen Default als String
                        isOptional,
                        description, // Füge die Beschreibung hinzu
                    });
                });
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    if (extractedProps.length === 0) {
        ts.forEachChild(sourceFile, node => {
            let propsTypeToAnalyze;
            let typeNodeForProps; // Für JSDoc auf dem Typknoten selbst

            if (ts.isExportAssignment(node) && node.expression && ts.isIdentifier(node.expression)) {
                const componentSymbol = typeChecker.getSymbolAtLocation(node.expression);
                if (componentSymbol) {
                    const componentType = typeChecker.getTypeOfSymbolAtLocation(componentSymbol, componentSymbol.valueDeclaration);
                    const callSignatures = componentType.getCallSignatures();
                    if (callSignatures.length > 0) {
                        const params = callSignatures[0].getParameters();
                        if (params.length > 0 && params[0].valueDeclaration) {
                            propsTypeToAnalyze = typeChecker.getTypeOfSymbolAtLocation(params[0], params[0].valueDeclaration);
                            // @ts-ignore
                            typeNodeForProps = params[0].valueDeclaration.type;
                        }
                    }
                }
            } else if (ts.isFunctionDeclaration(node) && node.name && node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword) && node.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
                if (node.parameters.length > 0) {
                    const propsParam = node.parameters[0];
                    if (propsParam.type) {
                        propsTypeToAnalyze = typeChecker.getTypeAtLocation(propsParam.type);
                        typeNodeForProps = propsParam.type;
                    }
                }
            }

            if (propsTypeToAnalyze) {
                // JSDoc für den gesamten Props-Typ (falls vorhanden)
                // const propsTypeDescription = typeNodeForProps ? getJSDocComment(typeChecker.getSymbolAtLocation(typeNodeForProps)) : undefined;

                propsTypeToAnalyze.getProperties().forEach(propSymbol => {
                    const propName = propSymbol.getName();
                    const propType = typeChecker.getTypeOfSymbolAtLocation(propSymbol, propSymbol.valueDeclaration || (typeNodeForProps || node));
                    const isOptional = (propSymbol.flags & ts.SymbolFlags.Optional) !== 0;
                    const description = getJSDocComment(propSymbol);

                    extractedProps.push({
                        name: propName,
                        type: propType,
                        defaultValueString: generateComplexDefaultValue(propType, typeChecker, MAX_RECURSION_DEPTH, propName, useStorybookActionsConfig), // propName und useStorybookActionsConfig übergeben
                        isOptional,
                        description,
                    });
                });
            }
        });
    }
    return { extractedProps, typeChecker };
}
module.exports = {
    getComponentNameFromPath, // Stelle sicher, dass alle Exporte erhalten bleiben
    getComponentImportPath,
    extractPropsFromComponent,
    // generateComplexDefaultValue, // Diese wird intern von extractPropsFromComponent genutzt
};