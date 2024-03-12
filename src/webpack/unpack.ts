import { promises as fs } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert'

import ts from 'typescript'
import { opinionatedFormat } from '../utils'

import { Project } from 'ts-morph'

// import prettier from 'prettier'
// import { Linter } from 'eslint'
// import myRules from '../eslint/lib/rules'

// const eslint = new Linter()
// eslint.defineRules(myRules)

interface ModuleSource {
    // [module, exports, require] ?
    args: [string, string, string]
    source: string
}
interface ChunkData {
    chunks: number[],
    modules: Map<number, ModuleSource>
}


export async function unpack(file: string, destPath: string): Promise<void> {

    await fs.mkdir(destPath, { recursive: true })
    console.log(file)

    const filepath = file
    const fileparsed = path.parse(filepath)
    const name = fileparsed.name
    const nodesFolder = path.join(destPath, name)

    await fs.mkdir(nodesFolder, { recursive: true })

    const source = await fs.readFile(file, { encoding: 'utf-8' })

    const chunkData = readChunkData(source)

    for (const [key, value] of chunkData.modules) {
        const modulePath = path.join(nodesFolder, `${key}.js`)
        const { args, source } = value
        await fs.writeFile(modulePath, opinionatedFormat(rewriteModule(args, `// ${args.join(' ')}\n let ${args.join(', ')};\n${source}`)))
    }

    // fs.writeFile(astpath, printer.printNode(ts.EmitHint.Unspecified, sourceFile, sourceFile))
    // const astpath = path.join(destPath, fileparsed.name + '.txt')
    // await fs.writeFile(astpath, debugAST(sourceFile, 10))
}

/**
 * Reads a webpack chunk and seperates it into modules.
 * @param source The source code of the webpack chunk.
 * @returns The chunk data.
 */
export function readChunkData(source: string): ChunkData {
    const sourceFile = ts.createSourceFile('index.ts', source, ts.ScriptTarget.ESNext, false)
    const statements = sourceFile.statements
    if (statements.length === 0) {
        throw new Error('File has no code?')
    } else if (statements.length === 1) {
        return readRootStatement(statements[0], sourceFile)
    } else if (statements.length === 2) {
        assert(isUseStrict(statements[0]))
        return readRootStatement(statements[1], sourceFile)
    } else {
        throw new Error('Unexpected number of statements')
    }
}

function isUseStrict(node: ts.Node): boolean {
    return ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression) && node.expression.text === 'use strict'
}

function readRootStatement(node: ts.Statement, sourceFile: ts.SourceFile): ChunkData {
    assert(ts.isExpressionStatement(node))
    const rootExpr = node.expression
    assert(ts.isCallExpression(rootExpr))
    const calledExpr = rootExpr.expression
    assertIsJsonp(calledExpr)
    const calledArgs = rootExpr.arguments
    return readJsonpArgs(calledArgs, sourceFile)
}

function assertIsJsonp(node: ts.Expression) {
    assert(ts.isPropertyAccessExpression(node))
    const name = node.name
    assert(ts.isIdentifier(name))
    assert(name.text === 'push')
    const expr = node.expression
    assert(ts.isParenthesizedExpression(expr))
    const expr2 = expr.expression
    assert(ts.isBinaryExpression(expr2))
    const { left, operatorToken, right } = expr2
    assertWebpackJsonp(left)
    assert(operatorToken.kind === ts.SyntaxKind.EqualsToken)
    assertJsonpRight(right)
}

function assertJsonpRight(node: ts.Expression) {
    assert(ts.isBinaryExpression(node))
    const { left, operatorToken, right } = node
    assertWebpackJsonp(left)
    assert(operatorToken.kind === ts.SyntaxKind.BarBarToken)
    assert(ts.isArrayLiteralExpression(right))
    assert(right.elements.length === 0)
}

const testSelf = /^(self|this)$/
const testWebpack = /^webpack[a-zA-Z_]+$/

function assertWebpackJsonp(node: ts.Expression) {
    assert(ts.isPropertyAccessExpression(node))
    const { expression, name } = node
    assert(ts.isIdentifier(expression))
    assert(testSelf.test(expression.text))
    assert(ts.isIdentifier(name))
    assert(testWebpack.test(name.text))
}

function readJsonpArgs(args: ts.NodeArray<ts.Expression>, sourceFile: ts.SourceFile): ChunkData {
    assert(args.length === 1)
    const expr = args[0]
    assert(ts.isArrayLiteralExpression(expr))
    const elements = expr.elements
    // console.log(elements[2].getText(elements[2].getSourceFile()))
    // console.log(elements[2])
    // console.dir(elements, {depth: 2})
    assert(elements.length > 1)
    const chunksEl = elements[0]
    assert(ts.isArrayLiteralExpression(chunksEl))
    const chunks = chunksEl.elements.map(readNumber)
    const modulesEl = elements[1]
    let modules
    if (ts.isArrayLiteralExpression(modulesEl)) {
        modules = readModulesArray(modulesEl, sourceFile)
    } else if (ts.isObjectLiteralExpression(modulesEl)) {
        modules = readModulesObject(modulesEl, sourceFile)

    } else if (ts.isCallExpression(modulesEl)) {
        modules = readModulesCall(modulesEl, sourceFile)
    } else {
        throw new Error('Unknown module list format')
    }
    return { chunks, modules }
}

function readNumber(node: ts.Node): number {
    assert(ts.isNumericLiteral(node))
    const value = Number(node.text)
    // console.log(node.text)
    // console.log(value)
    assert(Number.isSafeInteger(value))
    return value
}

function readModulesArray(node: ts.ArrayLiteralExpression, sourceFile: ts.SourceFile, startIndex = 0): Map<number, ModuleSource> {
    return new Map(node.elements.map((e, i) => [startIndex + i, readModuleFunction(e, sourceFile)]))
}

function readModulesObject(node: ts.ObjectLiteralExpression, sourceFile: ts.SourceFile): Map<number, ModuleSource> {
    return new Map(node.properties.map(p => {
        assert(ts.isPropertyAssignment(p))
        const { name, initializer } = p
        return [readNumber(name), readModuleFunction(initializer, sourceFile)]
    }))
}

function readModulesCall(node: ts.CallExpression, sourceFile: ts.SourceFile): Map<number, ModuleSource> {
    const startIndex = readConcat(node.expression)
    const args = node.arguments
    assert(args.length === 1)
    assert(ts.isArrayLiteralExpression(args[0]))
    return readModulesArray(args[0], sourceFile, startIndex)
}

function readConcat(node: ts.Node): number {
    assert(ts.isPropertyAccessExpression(node))
    const expr = node.expression
    const name = node.name
    assert(ts.isIdentifier(name))
    assert(name.text === 'concat')
    assert(ts.isCallExpression(expr))
    const callExpr = expr.expression
    const callArgs = expr.arguments
    assert(ts.isIdentifier(callExpr))
    assert(callExpr.text === 'Array')
    assert(callArgs.length === 1)
    return readNumber(callArgs[0])
}

function readModuleFunction(node: ts.Node, sourceFile: ts.SourceFile): ModuleSource {
    if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
        const { parameters, body } = node
        // console.log(parameters.length)
        assert(parameters.length < 4)
        return {
            args: parameters.map(readParameter) as [string, string, string],
            source: readBody(body, sourceFile),
        }
    } else {
        throw new Error('Unknown module type')
    }
}

function readParameter(node: ts.ParameterDeclaration): string {
    const name = node.name
    assert(ts.isIdentifier(name))
    return name.text
}

function readBody(node: ts.ConciseBody, sourceFile: ts.SourceFile): string {
    if (ts.isBlock(node)) {
        const text = node.getText(sourceFile)
        return text.slice(1, -1)
    }
    return node.getText(sourceFile)
}


// function formatSource(source: string) {
//     source = prettier.format(source, { parser: 'babel' })
//     const report = eslint.verifyAndFix(source, {
//         root: true,
//         rules: { 'custom/no-variable-reuse': ['warn'] },
//         env: { browser: true, es6: true },
//     })
//     source = report.output
//     source = prettier.format(source, { parser: 'babel' })
//     const report2 = eslint.verifyAndFix(source, {
//         root: true,
//         rules: { 'custom/no-variable-reuse': ['warn'] },
//         env: { browser: true, es6: true },
//     })
//     source = report2.output
//     return source
// }


function rewriteModule(params: string[], source: string) {
    const project = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: {
            target: ts.ScriptTarget.ESNext,
        },
    })
    const sourceFile = project.createSourceFile('index.ts', source)
    const descendantIdentifiers = sourceFile.getDescendantsOfKind(ts.SyntaxKind.Identifier)

    const [mod, exp, req] = params

    if (mod) {
        // console.log(mod)
        const modIdent = descendantIdentifiers.find(i => i.getText() === mod)
        if (modIdent) {
            modIdent.rename('module')
        }
    }
    if (exp) {
        const expIdent = descendantIdentifiers.find(i => i.getText() === exp)
        if (expIdent) {
            expIdent.rename('exports')
        }
    }
    if (req) {
        const reqIdent = descendantIdentifiers.find(i => i.getText() === req)
        if (reqIdent) {
            reqIdent.rename('require')
        }
    }
    sourceFile.saveSync()
    return sourceFile.getText()
}
