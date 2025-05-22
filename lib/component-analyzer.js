// storybook-path-watcher/lib/component-analyzer.js
const path = require('path');
const ts = require('typescript');
// const chalk = require('chalk'); // Falls hier geloggt wird

// Benötigt CWD aus config
function getComponentNameFromPath(filePath, baseDir) { /* ... unverändert ... */
    const relativePath = path.relative(baseDir, filePath);
    const dirInComponents = path.dirname(relativePath);
    componentName = componentName.replace(/\.(component|module)$/i, '');
    const parentDirName = path.basename(dirInComponents);

    if (componentName.toLowerCase() === 'index' && parentDirName && parentDirName !== '.' && parentDirName !== path.basename(baseDir)) {
        componentName = parentDirName;
    } else if (componentName.toLowerCase() === parentDirName.toLowerCase() && parentDirName && parentDirName !== '.') {
        componentName = parentDirName;
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
function generateComplexDefaultValue(type, typeChecker, MAX_RECURSION_DEPTH, depth = 0) { /* ... unverändert ... */
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
    if (displayType.includes('=>') || displayType.startsWith('(')) return "() => {}";
    if (displayType === 'React.ReactNode' || displayType === 'React.ReactElement') {
        return "undefined /* ReactNode/Element placeholder */";
    }
    if (type.flags & ts.TypeFlags.Object) return "{}";
    return `undefined /* type: ${displayType} */`;
}

// Benötigt CWD und MAX_RECURSION_DEPTH aus config
function extractPropsFromComponent(componentPath, CWD, MAX_RECURSION_DEPTH) { /* ... (Logik leicht anpassen, um CWD und MAX_RECURSION_DEPTH zu nutzen) ... */
    const program = ts.createProgram([componentPath], {
        jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, allowJs: true,
        baseUrl: CWD, paths: { "@/*": ["src/*"] }
    });
    const sourceFile = program.getSourceFile(componentPath);
    const typeChecker = program.getTypeChecker();
    const extractedProps = [];
    if (!sourceFile) { /* console.warn(...) */ return extractedProps; }
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
                    extractedProps.push({
                        name: propName, type: propType,
                        defaultValue: generateComplexDefaultValue(propType, typeChecker, MAX_RECURSION_DEPTH),
                        isOptional,
                    });
                });
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    if (extractedProps.length === 0) { /* ... (Fallback-Logik wie gehabt, nutzt generateComplexDefaultValue) ... */
        ts.forEachChild(sourceFile, node => {
            let propsTypeToAnalyze;
            // ... (Logik zur Identifizierung von propsTypeToAnalyze) ...
            if (ts.isExportAssignment(node) && node.expression && ts.isIdentifier(node.expression)) { /* ... */ }
            else if (ts.isFunctionDeclaration(node) && node.name && node.modifiers /* ... */) { /* ... */ }


            if (propsTypeToAnalyze) {
                propsTypeToAnalyze.getProperties().forEach(propSymbol => {
                    // ... (Prop-Extraktion wie gehabt, aber mit generateComplexDefaultValue) ...
                    const propName = propSymbol.getName();
                    const propType = typeChecker.getTypeOfSymbolAtLocation(propSymbol, propSymbol.valueDeclaration || node);
                    const isOptional = (propSymbol.flags & ts.SymbolFlags.Optional) !== 0;
                    extractedProps.push({
                        name: propName, type: propType,
                        defaultValue: generateComplexDefaultValue(propType, typeChecker, MAX_RECURSION_DEPTH),
                        isOptional,
                    });
                });
            }
        });
    }
    return extractedProps;
}

module.exports = {
    getComponentNameFromPath,
    getComponentImportPath,
    extractPropsFromComponent,
};