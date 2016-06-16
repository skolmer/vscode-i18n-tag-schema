"use strict";

import * as vscode from 'vscode';
import * as fs from "fs"
import * as path from 'path';
import i18nTagSchema from 'i18n-tag-schema'

const spinner = ['🌍 ',	'🌎 ', '🌏 ']
const spinnerInterval = 500
const spinnerLength = spinner.length
const spinnerMessage = 'Generating i18n translation schema'
let config
let filter
let srcPath
let schema
let info = ''
let spinnerInstance: vscode.StatusBarItem
let spinnerIndex = 0
let showSpinner = false
let outputChannel: vscode.OutputChannel
let oldSchema: string

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('i18nTag')
    context.subscriptions.push(outputChannel)

    var configureSchemaGenerator = vscode.commands.registerCommand('i18nTag.configureSchemaGenerator', (context) => {     
        return new Promise((resolve, reject) => {
            vscode.window.showInputBox({
                prompt: 'What is the source directory of your JS application?', 
                placeHolder: 'e.g. ./src',
                value: './src',
                validateInput: (val) =>  {
                        if(!val) return 'Source directory setting is required!'
                        return null
                    } 
            }).then((srcProperty) => {
                if(!srcProperty || !fs.existsSync(path.resolve(vscode.workspace.rootPath, srcProperty))) {
                    reject('Source directory cannot be found!')
                    return
                }
                vscode.window.showInputBox({
                    prompt: 'What should be the name of your translation schema?', 
                    placeHolder: 'e.g. ./translation.schema.json',
                    value: './translation.schema.json',
                    validateInput: (val) =>  {
                        if(!val) return 'Schema path setting is required!'
                        return null
                    } 
                }).then((schemaProperty) => {
                    if(!schemaProperty || !fs.existsSync(path.dirname(path.resolve(vscode.workspace.rootPath, schemaProperty)))) {
                        reject('Schema path cannot be found!')
                        return
                    }
                    vscode.window.showInputBox({
                        prompt: 'Only files that match this RegExp will be scanned!', 
                        placeHolder: 'e.g. \\.jsx?',
                        value: '\\.jsx?',
                        validateInput: (val) =>  {
                        if(!val) return 'File extension RegExp setting is required!'                        
                        return null
                    } 
                    }).then((filterProperty) => {
                        if(!filterProperty) {
                            reject('Filter setting is required!')
                            return
                        }
                        try {
                            new RegExp(filterProperty);
                        } catch(e) {
                            reject('Invalid RegExp!')
                            return 
                        }
                        vscode.window.showInputBox({
                            prompt: 'Optional: Where are your translation files located?', 
                            placeHolder: 'e.g. /translations/**/*.json'
                        }).then((translationsProperty) => {
                            updateSettings(srcProperty, schemaProperty, filterProperty, resolve, reject, translationsProperty)
                        }, reject)
                    }, reject)
                }, reject)
            }, reject)
        })          
    })

    var updateSchemaCommand = vscode.commands.registerCommand('i18nTag.updateSchema', (context) => {
        readConfig().then(() => {
            updateSchema(context)
        })        
    })

    var showTranslationSchema = vscode.commands.registerCommand('i18nTag.showTranslationSchema', (context) => {
        readConfig().then(() => {
            vscode.workspace.openTextDocument(schema).then((file) => { 
                vscode.window.showTextDocument(file)
            }, (reason) => {
                vscode.window.showErrorMessage(reason)
            });
        })        
    })

    var showTranslationSchemaChanges = vscode.commands.registerCommand('i18nTag.showTranslationSchemaChanges', (context) => {
        readConfig().then(() => {
            if(oldSchema) {
                vscode.commands.executeCommand('vscode.diff', vscode.Uri.parse('i18n-schema:old.json'), vscode.Uri.parse(`i18n-schema:${path.basename(schema)}`)) 
            } else {
                vscode.window.showInformationMessage(`Schema has no local changes`)
            }
        })        
    })    

    let registration = vscode.workspace.registerTextDocumentContentProvider('i18n-schema', {
        provideTextDocumentContent(uri) {
            switch(uri.path) {
                case 'old.json':
                    return oldSchema
                default:
                    return new Promise((resolve, reject) => {
                        vscode.workspace.openTextDocument(schema).then((file) => {        
                            resolve(file.getText())
                        }, (reason) => {
                            reject(reason)
                        });
                    })
            }
        }
    })

    context.subscriptions.push(configureSchemaGenerator, updateSchemaCommand, showTranslationSchema, showTranslationSchemaChanges, registration)
}

function readConfig() {
    return new Promise((resolve, reject) => {
        config = vscode.workspace.getConfiguration('i18nTag')
        filter = config['filter']
        if(!filter) {
            vscode.commands.executeCommand('i18nTag.configureSchemaGenerator').then(resolve, reject)
            return
        }
        srcPath = config['src']
        if(srcPath) {
            srcPath = path.resolve(vscode.workspace.rootPath, srcPath)            
        } else {
            vscode.commands.executeCommand('i18nTag.configureSchemaGenerator').then(resolve, reject)
            return
        }
        schema = config['schema']
        if(schema) {
            schema = path.resolve(vscode.workspace.rootPath, schema)
        } else {
            vscode.commands.executeCommand('i18nTag.configureSchemaGenerator').then(resolve, reject)
            return
        }
        resolve();
    })
}

function updateSettings(src: string, schm: string, filt: string, resolve: () => void, reject: (reason: string) => void, translations?: string) {    
    if(!src || !schm || !filt) {
        reject('Missing required settings')
        return
    }
    
    const settingsPath = path.resolve(vscode.workspace.rootPath, './.vscode/settings.json')

    fs.readFile(settingsPath, 'utf-8', (err, contents) => {
        let settings = (contents)?JSON.parse(contents.replace(/\/\/[^\r\n\{\}]*/g, '')):{}
        settings['i18nTag.src'] = src
        settings['i18nTag.schema'] = schm
        settings['i18nTag.filter'] = filt
        let schemas = settings['json.schemas'] || []
        schemas = schemas.filter((val) => ( !val.url || val.url != schm ))
        if(translations) {            
            schemas.push({
                "fileMatch": [
                    translations
                ],
                "url": schm
            })            
        }
        settings['json.schemas'] = schemas
        if(!fs.existsSync(path.dirname(settingsPath))) {
            try {
                fs.mkdir(path.dirname(settingsPath))
            } catch(err) {
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
            vscode.window.showInformationMessage('Sucessfully configured translation schema generator').then(resolve, reject)
        })
    });
    
    
}

function spin(start) {
    showSpinner = start
    if(!showSpinner && spinnerInstance) {        
        spinnerInstance.dispose()
        spinnerInstance = undefined
        spinnerIndex = 0
        info = ''
    }
    if(showSpinner) {
        let char = spinner[spinnerIndex]      
        if(!spinnerInstance) {
            spinnerInstance = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, Number.MIN_SAFE_INTEGER)
            spinnerInstance.show()
        } 
        if(info) {
            spinnerInstance.text = `${char} ${spinnerMessage}: ${info}`
        } else {
            spinnerInstance.text = `${char} ${spinnerMessage}...`
        }
        
        if(spinnerIndex < spinnerLength-1) {
            spinnerIndex++
        } else {
            spinnerIndex = 0
        }   
        setTimeout(() => {
            spin(showSpinner)
        }, spinnerInterval);
    }
}

function updateSchema(context: vscode.ExtensionContext) {   
    spin(true)
    const callback = (message: string, type: string = 'success') => {
        info = ''
        switch (type) {
            case 'success':
                spin(false)
                if(message.indexOf('i18nTag json schema has been updated') > -1) {
                    var items = (oldSchema) ? ['Show Diff'] : []
                    vscode.window.showInformationMessage(message, ...items).then((value) => {
                        if(value === 'Show Diff') {
                            vscode.commands.executeCommand('vscode.diff', vscode.Uri.parse('i18n-schema:old.json'), vscode.Uri.parse(`i18n-schema:${path.basename(schema)}`)) 
                        }
                    })
                } else {
                    vscode.window.showInformationMessage(message, 'Show File').then((value) => {
                        if(value === 'Show File') {
                            vscode.workspace.openTextDocument(schema).then((file) => { 
                                vscode.window.showTextDocument(file)
                            }, (reason) => {
                                vscode.window.showErrorMessage(reason)
                            });
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
    vscode.workspace.openTextDocument(schema).then((file) => {        
        oldSchema = file.getText()
        i18nTagSchema(srcPath, filter, schema, callback)
    }, (reason) => {
        oldSchema = null
        i18nTagSchema(srcPath, filter, schema, callback)
    });
}

export function deactivate() {
}