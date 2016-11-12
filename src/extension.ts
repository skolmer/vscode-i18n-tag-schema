import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import * as chalk from 'chalk'
import { generateTranslationSchema, exportTranslationKeys, validateTranslations } from 'i18n-tag-schema'
import { readTemplatesFromFileContent } from 'i18n-tag-schema/dist/lib/export'

const spinner = ['🌍 ', '🌎 ', '🌏 ']
const spinnerInterval = 180
const spinnerLength = spinner.length
const spinnerMessage = 'Collecting i18n template literals'
let config
let filter
let srcPath
let preprocessor
let schema
let babylonConfig
let info = ''
let spinnerInstance: vscode.StatusBarItem
let spinnerIndex = 0
let showSpinner = false
let outputChannel: vscode.OutputChannel
let oldSchema: string
let templatesJson: string
let emitter = new vscode.EventEmitter<vscode.Uri>()

const log = (message) => {
    outputChannel.appendLine(message)
    outputChannel.show(true)
}

const logger = {
    info: (message) => log(`${chalk.black.bgWhite.bold(' INFO ')} ${message}`),
    warn: (message) => log(`${chalk.black.bgYellow.bold(' WARN ')} ${message}`),
    error: (message) => log(`${chalk.white.bgRed.bold(' ERROR ')} ${message}`)
}

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('i18nTag')
    context.subscriptions.push(outputChannel)

    const configureSchemaGenerator = vscode.commands.registerCommand('i18nTag.configureSchemaGenerator', (context) => {
        return new Promise((resolve, reject) => {
            vscode.window.showInputBox({
                prompt: 'What is the source directory of your JS application?',
                placeHolder: 'e.g. ./src',
                value: './src',
                validateInput: (val) => {
                    if (!val) return 'Source directory setting is required!'
                    return null
                }
            }).then((srcProperty) => {
                if (!srcProperty || !fs.existsSync(path.resolve(vscode.workspace.rootPath, srcProperty))) {
                    reject('Source directory cannot be found!')
                    return
                }
                vscode.window.showInputBox({
                    prompt: 'What should be the name of your translation schema?',
                    placeHolder: 'e.g. ./translation.schema.json',
                    value: './translation.schema.json',
                    validateInput: (val) => {
                        if (!val) return 'Schema path setting is required!'
                        return null
                    }
                }).then((schemaProperty) => {
                    if (!schemaProperty || !fs.existsSync(path.dirname(path.resolve(vscode.workspace.rootPath, schemaProperty)))) {
                        reject('Schema path cannot be found!')
                        return
                    }
                    vscode.window.showInputBox({
                        prompt: 'Only files that match this RegExp will be scanned!',
                        placeHolder: 'e.g. \\.jsx?$',
                        value: '\\.jsx?',
                        validateInput: (val) => {
                            if (!val) return 'File extension RegExp setting is required!'
                            return null
                        }
                    }).then((filterProperty) => {
                        if (!filterProperty) {
                            reject('Filter setting is required!')
                            return
                        }
                        try {
                            new RegExp(filterProperty)
                        } catch (e) {
                            reject('Invalid RegExp!')
                            return
                        }
                        vscode.window.showInputBox({
                            prompt: 'Optional: Where are your translation files located?',
                            placeHolder: 'e.g. /translations/**/*.json'
                        }).then((translationsProperty) => {
                            vscode.window.showInputBox({
                                prompt: 'Optional: Do you want to use a proprocessor?',
                                placeHolder: 'e.g. ./preprocessors/typescript'
                            }).then((preprocessor) => {
                                updateSettings(srcProperty, schemaProperty, filterProperty, resolve, reject, translationsProperty, preprocessor)
                            }, reject)
                        }, reject)
                    }, reject)
                }, reject)
            }, reject)
        })
    })

    const updateSchemaCommand = vscode.commands.registerCommand('i18nTag.updateSchema', (context) => {
        return new Promise((resolve, reject) => {
            readConfig().then(() => {
                updateSchema(context)
                resolve()
            }, reject)
        })
    })

    const showTranslationSchema = vscode.commands.registerCommand('i18nTag.showTranslationSchema', (context) => {
        return new Promise((resolve, reject) => {
            readConfig().then(() => {
                vscode.workspace.openTextDocument(schema).then((file) => {
                    vscode.window.showTextDocument(file)
                }, (reason) => {
                    vscode.window.showErrorMessage(reason)
                })
                resolve()
            }, reject)
        })
    })

    const showTranslationSchemaChanges = vscode.commands.registerCommand('i18nTag.showTranslationSchemaChanges', (context) => {
        return new Promise((resolve, reject) => {
            readConfig().then(() => {
                if (oldSchema) {
                    const oldUri = vscode.Uri.parse('i18n-schema:old.json')
                    const newUri = vscode.Uri.parse(`i18n-schema:${path.basename(schema)}`)
                    emitter.fire(oldUri)
                    emitter.fire(newUri)
                    vscode.commands.executeCommand('vscode.diff', oldUri, newUri)
                } else {
                    vscode.window.showInformationMessage(`Schema has no local changes`)
                }
                resolve()
            }, reject)
        })
    })

    const exportKeys = vscode.commands.registerCommand('i18nTag.exportKeys', async (context) => {
        await readConfig()
        outputChannel.appendLine(`exporting keys from ${srcPath}...`)
        outputChannel.show(true)
        spin(true)
        try {
            const tmpl = await exportTranslationKeys({ rootPath: srcPath, filePath: '.', filter: filter, logger: logger, preprocessor: preprocessor, babylonConfig: babylonConfig })
            templatesJson = JSON.stringify(tmpl, null, 2)
            const uri = vscode.Uri.parse('i18n-schema:templates.json')
            emitter.fire(uri)
            const file = await vscode.workspace.openTextDocument(uri)
            await vscode.window.showTextDocument(file, vscode.ViewColumn.Two, true)
            spin(false)
        } catch(err) {
            spin(false)
            await vscode.window.showErrorMessage(err)
            outputChannel.appendLine(err.message)
            outputChannel.show(true)
        }
    })

    const listOpenTemplates = vscode.commands.registerCommand('i18nTag.listOpenTemplates', async () => {
        await readConfig()
        templatesJson = ''
        const doc = vscode.window.activeTextEditor.document
        if (doc && doc.fileName && (doc.languageId === 'javascript' || doc.languageId === 'javascriptreact')) {
            outputChannel.appendLine(`listing template literals from ${doc.fileName}...`)
            outputChannel.show(true)
            spin(true)
            try {
                const content = doc.getText()
                const tmpl = await readTemplatesFromFileContent({rootPath: srcPath, filePath: doc.fileName, content: content, preprocessor: preprocessor, babylonConfig: babylonConfig })
                templatesJson = JSON.stringify(tmpl.templates, null, 2)
                const uri = vscode.Uri.parse('i18n-schema:templates.json')
                emitter.fire(uri)
                const file = await vscode.workspace.openTextDocument(uri)
                await vscode.window.showTextDocument(file, vscode.ViewColumn.Two, true)
                spin(false)
            } catch(err) {
                spin(false)
                await vscode.window.showErrorMessage(err.message)
                outputChannel.appendLine(err)
                outputChannel.show(true)
            }
        } else {
            throw new Error('This command can only be executed on an open javascript file')
        }
    })

    const listTemplates = vscode.commands.registerCommand('i18nTag.listTemplates', async (resourceUri) => {
        await readConfig()
        templatesJson = ''
        let docUri = resourceUri && resourceUri.fsPath
        if(!docUri) throw new Error('This command can only be executed on an open javascript file')
        outputChannel.appendLine(`listing template literals from ${docUri}...`)
        outputChannel.show(true)
        spin(true)
        try {
            const tmpl = await exportTranslationKeys({ rootPath: srcPath, filePath: docUri, filter: filter, logger: logger, preprocessor: preprocessor, babylonConfig: babylonConfig })
            templatesJson = JSON.stringify(tmpl, null, 2)
            const uri = vscode.Uri.parse('i18n-schema:templates.json')
            emitter.fire(uri)
            const file = await vscode.workspace.openTextDocument(uri)
            await vscode.window.showTextDocument(file, vscode.ViewColumn.Two, true)
            spin(false)
        } catch(err) {
            spin(false)
            await vscode.window.showErrorMessage(err.message)
            outputChannel.appendLine(err)
            outputChannel.show(true)
        }
    })

    const _validateTranslation = async (docUri) => {
        outputChannel.appendLine(`validating translation ${docUri}...`)
        outputChannel.show(true)
        spin(true)
        try {
        const result = await validateTranslations({ rootPath: docUri, schemaPath: schema, logger: logger })
            spin(false)
            outputChannel.appendLine(result)
            await vscode.window.showInformationMessage(result)
            outputChannel.show(true)
        } catch(err) {
            spin(false)
            outputChannel.appendLine(err.message)
            await vscode.window.showErrorMessage(err.message)
            outputChannel.show(true)
        }
    }

    const validateTranslation = vscode.commands.registerCommand('i18nTag.validateTranslation', async (resourceUri) => {
        await readConfig()
        templatesJson = ''
        let docUri
        if(resourceUri && resourceUri.fsPath) {
            docUri = resourceUri.fsPath
        }
        if(!docUri) throw new Error('This command can only be executed on an open translation file')
        await _validateTranslation(docUri)
    })

    const validateOpenTranslation = vscode.commands.registerCommand('i18nTag.validateOpenTranslation', async () => {
        await readConfig()
        templatesJson = ''
        const doc = vscode.window.activeTextEditor.document
        let docUri
        if(doc && doc.fileName && doc.languageId === 'json') {
            docUri = doc.fileName
        }
        if(!docUri) throw new Error('This command can only be executed on an open translation file')
        await _validateTranslation(docUri)
    })

    const registration = vscode.workspace.registerTextDocumentContentProvider('i18n-schema', {
        onDidChange: emitter.event,
        provideTextDocumentContent(uri) {
            switch (uri.path) {
                case 'old.json':
                    return new Promise((resolve, reject) => {
                        resolve(oldSchema)
                    })
                case 'templates.json':
                    return new Promise((resolve, reject) => {
                        resolve(templatesJson)
                    })
                default:
                    return new Promise((resolve, reject) => {
                        vscode.workspace.openTextDocument(schema).then((file) => {
                            resolve(file.getText())
                        }, (reason) => {
                            reject(reason)
                        })
                    })
            }
        }
    })

    context.subscriptions.push(configureSchemaGenerator, updateSchemaCommand, showTranslationSchema, showTranslationSchemaChanges, registration, listTemplates, exportKeys, validateTranslation, listOpenTemplates, validateOpenTranslation)
}

async function readConfig() {
    config = vscode.workspace.getConfiguration('i18nTag')
    filter = config['filter']
    preprocessor = config['preprocessor']
    babylonConfig = config['babylonConfig']
    if (!filter) {
        return await vscode.commands.executeCommand('i18nTag.configureSchemaGenerator')
    }
    srcPath = config['src']
    if (srcPath) {
        srcPath = path.resolve(vscode.workspace.rootPath, srcPath)
    } else {
        return await vscode.commands.executeCommand('i18nTag.configureSchemaGenerator')
    }
    schema = config['schema']
    if (schema) {
        schema = path.resolve(vscode.workspace.rootPath, schema)
    } else {
        return await vscode.commands.executeCommand('i18nTag.configureSchemaGenerator')
    }
}

function updateSettings(src: string, schm: string, filt: string, resolve: () => void, reject: (reason: string) => void, translations?: string, preproc?: string) {
    if (!src || !schm || !filt) {
        reject('Missing required settings')
        return
    }

    const settingsPath = path.resolve(vscode.workspace.rootPath, './.vscode/settings.json')

    fs.readFile(settingsPath, 'utf-8', (err, contents) => {
        let settings = (contents) ? JSON.parse(contents.replace(/\/\/[^\r\n\{\}]*/g, '').replace(/\/\*[^\/]*\*\//g, '')) : {}
        settings['i18nTag.src'] = src
        settings['i18nTag.schema'] = schm
        settings['i18nTag.filter'] = filt
        if(preproc) settings['i18nTag.preprocessor'] = preproc
        let schemas = settings['json.schemas'] || []
        schemas = schemas.filter((val) => (!val.url || val.url != schm))
        if (translations) {
            schemas.push({
                "fileMatch": [
                    translations
                ],
                "url": schm
            })
        }
        settings['json.schemas'] = schemas
        if (!fs.existsSync(path.dirname(settingsPath))) {
            try {
                fs.mkdir(path.dirname(settingsPath))
            } catch (err) {
                reject(err.message)
                return
            }
        }
        fs.writeFile(settingsPath, JSON.stringify(settings, null, '\t'), 'utf-8', (err) => {
            if (err) {
                vscode.window.showInformationMessage(`Configuration of translation schema generator failed. ${err.message}`)
                reject(err.message)
                return
            }
            filter = filt
            preprocessor = preproc
            srcPath = path.resolve(vscode.workspace.rootPath, src)
            schema = path.resolve(vscode.workspace.rootPath, schm)
            vscode.window.showInformationMessage('Sucessfully configured translation schema generator').then(resolve, reject)
        })
    })
}

function spin(start) {
    showSpinner = start
    if (!showSpinner && spinnerInstance) {
        spinnerInstance.dispose()
        spinnerInstance = undefined
        spinnerIndex = 0
        info = ''
    }
    if (showSpinner) {
        let char = spinner[spinnerIndex]
        if (!spinnerInstance) {
            spinnerInstance = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, Number.MIN_SAFE_INTEGER)
            spinnerInstance.show()
        }
        if (info) {
            spinnerInstance.text = `${char} ${spinnerMessage}: ${info}`
        } else {
            spinnerInstance.text = `${char} ${spinnerMessage}...`
        }

        if (spinnerIndex < spinnerLength - 1) {
            spinnerIndex++
        } else {
            spinnerIndex = 0
        }
        setTimeout(() => {
            spin(showSpinner)
        }, spinnerInterval)
    }
}

function updateSchema(context: vscode.ExtensionContext) {
    spin(true)
    const update = async () => {
        try {
            await generateTranslationSchema({ rootPath: srcPath, filter: filter, schemaPath: schema, logger: logger, preprocessor: preprocessor, babylonConfig: babylonConfig })
            spin(false)
            var items = (oldSchema) ? ['Show Diff'] : ['Show File']
            const value = await vscode.window.showInformationMessage('i18n json schema has been updated', ...items)
            if (value === 'Show Diff') {
                const oldUri = vscode.Uri.parse('i18n-schema:old.json')
                const newUri = vscode.Uri.parse(`i18n-schema:${path.basename(schema)}`)
                emitter.fire(oldUri)
                emitter.fire(newUri)
                vscode.commands.executeCommand('vscode.diff', oldUri, newUri)
            }
            if (value === 'Show File') {
                try {
                    const file = await vscode.workspace.openTextDocument(schema)
                    vscode.window.showTextDocument(file)
                } catch(err) {
                    vscode.window.showErrorMessage(err.message)
                }
            }
        } catch (err) {
            outputChannel.append(err)
            vscode.window.showErrorMessage(err.message)
            spin(false)
        }
    }

    fs.readFile(schema, 'utf-8', (err, contents) => {
        if (err) {
            oldSchema = null
        } else {
            oldSchema = contents
        }
        update()
    })
}

export function deactivate() {
}