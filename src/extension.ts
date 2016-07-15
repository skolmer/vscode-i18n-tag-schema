"use strict"

import * as vscode from 'vscode'
import * as fs from "fs"
import * as path from 'path'
import i18nTagSchema, { exportTranslationKeys, validateSchema } from 'i18n-tag-schema'

const spinner = ['🌍 ', '🌎 ', '🌏 ']
const spinnerInterval = 180
const spinnerLength = spinner.length
const spinnerMessage = 'Collecting i18n template literals'
let config
let filter
let srcPath
let schema
let grouped
let info = ''
let spinnerInstance: vscode.StatusBarItem
let spinnerIndex = 0
let showSpinner = false
let outputChannel: vscode.OutputChannel
let oldSchema: string
let templatesJson: string
let emitter = new vscode.EventEmitter<vscode.Uri>()

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('i18nTag')
    context.subscriptions.push(outputChannel)

    var configureSchemaGenerator = vscode.commands.registerCommand('i18nTag.configureSchemaGenerator', (context) => {
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
                            let quickPicks = ['no', 'yes']
                            vscode.window.showQuickPick(quickPicks, {
                                placeHolder: 'Should translations be grouped by source filename?'
                            }).then((groupedProperty) => {
                                updateSettings(srcProperty, schemaProperty, filterProperty, resolve, reject, groupedProperty === quickPicks[1], translationsProperty)
                            }, reject)
                        }, reject)
                    }, reject)
                }, reject)
            }, reject)
        })
    })

    var updateSchemaCommand = vscode.commands.registerCommand('i18nTag.updateSchema', (context) => {
        return new Promise((resolve, reject) => {
            readConfig().then(() => {
                updateSchema(context)
                resolve()
            }, reject)
        })
    })

    var showTranslationSchema = vscode.commands.registerCommand('i18nTag.showTranslationSchema', (context) => {
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

    var showTranslationSchemaChanges = vscode.commands.registerCommand('i18nTag.showTranslationSchemaChanges', (context) => {
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

    var exportKeys = vscode.commands.registerCommand('i18nTag.exportKeys', (context) => {
        return new Promise((resolve, reject) => {
            readConfig().then(() => {
                outputChannel.appendLine(`exporting keys from ${srcPath}...`)
                outputChannel.show(true)
                spin(true)
                exportTranslationKeys(srcPath, '.', grouped,
                    (message, type) => {
                        switch (type) {
                            case 'error':
                                vscode.window.showErrorMessage(message).then(() => {
                                    spin(false)
                                    outputChannel.appendLine(message)
                                    reject(message)
                                })
                                break
                            case 'warn':
                                vscode.window.showWarningMessage(message).then(() => {
                                    spin(false)
                                    outputChannel.appendLine(message)
                                })
                                break
                            default:
                                outputChannel.appendLine(message)
                                outputChannel.show(true)
                                break
                        }
                    },
                    (tmpl) => {
                        templatesJson = JSON.stringify(JSON.parse(tmpl), null, 2)
                        const uri = vscode.Uri.parse('i18n-schema:templates.json')
                        emitter.fire(uri);
                        vscode.workspace.openTextDocument(uri).then((file) => {
                            vscode.window.showTextDocument(file, vscode.ViewColumn.Two, true).then((editor) => {
                                spin(false)
                                resolve()
                            }, (reason) => {
                                spin(false)
                                reject(reason)
                            })
                        }, (reason) => {
                            spin(false)
                            reject(reason)
                        })
                    }
                )
            }, reject)
        })
    })

    var listTemplates = vscode.commands.registerCommand('i18nTag.listTemplates', (resourceUri) => {
        return new Promise((resolve, reject) => {
            readConfig().then(() => {
                templatesJson = ''
                const doc = vscode.window.activeTextEditor.document
                let docUri = resourceUri && resourceUri.fsPath
                if(!docUri) {
                    if (doc && doc.fileName && (doc.languageId === 'javascript' || doc.languageId === 'javascriptreact')) {
                        docUri = doc.fileName                    
                    } else {
                        reject('This command can only be executed on an open javascript file')
                        return
                    }
                }
                outputChannel.appendLine(`listing template literals from ${docUri}...`)
                spin(true)
                exportTranslationKeys(srcPath, docUri, grouped,
                    (message, type) => {
                        switch (type) {
                            case 'error':
                                vscode.window.showErrorMessage(message).then(() => {
                                    spin(false)
                                    outputChannel.appendLine(message)
                                    reject(message)
                                })
                                break
                            case 'warn':
                                vscode.window.showWarningMessage(message).then(() => {
                                    spin(false)
                                    outputChannel.appendLine(message)
                                })
                                break
                            default:
                                outputChannel.appendLine(message)
                                outputChannel.show(true)
                                break
                        }
                    },
                    (tmpl) => {
                        templatesJson = JSON.stringify(JSON.parse(tmpl), null, 2)
                        const uri = vscode.Uri.parse('i18n-schema:templates.json')
                        emitter.fire(uri);
                        vscode.workspace.openTextDocument(uri).then((file) => {
                            vscode.window.showTextDocument(file, vscode.ViewColumn.Two, true).then((editor) => {
                                spin(false)
                                resolve()
                            }, (reason) => {
                                spin(false)
                                reject(reason)
                            })
                        }, (reason) => {
                            spin(false)
                            reject(reason)
                        })
                    }
                )
            }, reject)
        })
    })

    var validateTranslation = vscode.commands.registerCommand('i18nTag.validateTranslation', (resourceUri) => {
        return new Promise((resolve, reject) => {
            readConfig().then(() => {
                templatesJson = ''
                const doc = vscode.window.activeTextEditor.document
                let docUri = resourceUri && resourceUri.fsPath
                if(!docUri) {
                    if (doc && doc.fileName && (doc.languageId === 'json')) {
                        docUri = doc.fileName                    
                    } else {
                        reject('This command can only be executed on an open translation file')
                        return
                    }
                }
                outputChannel.appendLine(`validating translation ${docUri}...`)
                validateSchema(docUri, schema,
                    (message, type) => {
                        switch (type) {
                            case 'error':
                                vscode.window.showErrorMessage(message).then(() => {
                                    outputChannel.appendLine(message)
                                    reject(message)
                                })
                                break
                            case 'success':
                                vscode.window.showInformationMessage(message).then(() => {
                                    outputChannel.appendLine(message)
                                    resolve()
                                })
                                break
                            default:
                                outputChannel.appendLine(message)
                                outputChannel.show(true)
                                break
                        }
                    }
                )
            }, reject)
        })
    })

    let registration = vscode.workspace.registerTextDocumentContentProvider('i18n-schema', {
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

    context.subscriptions.push(configureSchemaGenerator, updateSchemaCommand, showTranslationSchema, showTranslationSchemaChanges, registration, listTemplates, exportKeys, validateTranslation)
}

function readConfig() {
    return new Promise((resolve, reject) => {
        config = vscode.workspace.getConfiguration('i18nTag')
        filter = config['filter']
        if (!filter) {
            vscode.commands.executeCommand('i18nTag.configureSchemaGenerator').then(resolve, reject)
            return
        }
        srcPath = config['src']
        if (srcPath) {
            srcPath = path.resolve(vscode.workspace.rootPath, srcPath)
        } else {
            vscode.commands.executeCommand('i18nTag.configureSchemaGenerator').then(resolve, reject)
            return
        }
        schema = config['schema']
        if (schema) {
            schema = path.resolve(vscode.workspace.rootPath, schema)
        } else {
            vscode.commands.executeCommand('i18nTag.configureSchemaGenerator').then(resolve, reject)
            return
        }
        grouped = config['grouped']
        resolve()
    })
}

function updateSettings(src: string, schm: string, filt: string, resolve: () => void, reject: (reason: string) => void, group: boolean, translations?: string) {
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
        settings['i18nTag.grouped'] = group
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
            srcPath = path.resolve(vscode.workspace.rootPath, src)
            schema = path.resolve(vscode.workspace.rootPath, schm)
            grouped = group
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
    const callback = (message: string, type: string = 'success') => {
        info = ''
        switch (type) {
            case 'success':
                spin(false)
                if (message.indexOf('i18n json schema has been updated') > -1) {
                    var items = (oldSchema) ? ['Show Diff'] : []
                    vscode.window.showInformationMessage(message, ...items).then((value) => {
                        if (value === 'Show Diff') {
                            const oldUri = vscode.Uri.parse('i18n-schema:old.json')
                            const newUri = vscode.Uri.parse(`i18n-schema:${path.basename(schema)}`)
                            emitter.fire(oldUri)
                            emitter.fire(newUri)
                            vscode.commands.executeCommand('vscode.diff', oldUri, newUri)
                        }
                    })
                } else {
                    vscode.window.showInformationMessage(message, 'Show File').then((value) => {
                        if (value === 'Show File') {
                            vscode.workspace.openTextDocument(schema).then((file) => {
                                vscode.window.showTextDocument(file)
                            }, (reason) => {
                                vscode.window.showErrorMessage(reason)
                            })
                        }
                    })
                }
                break
            case 'warn':
                vscode.window.showWarningMessage(message)
                break
            case 'error':
                spin(false)
                vscode.window.showErrorMessage(message)
                break
            case 'info':
                info = message
                outputChannel.appendLine(message)
                break
            default:
                outputChannel.appendLine(message)
                outputChannel.show(true)
                break
        }
    }
    const update = () => {
        try {
            i18nTagSchema(srcPath, filter, schema, grouped, callback)
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
    });
}

export function deactivate() {
}