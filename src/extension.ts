"use strict";

import * as vscode from 'vscode';
import * as fs from "fs"
import * as path from 'path';
import i18nTagSchema from 'i18n-tag-schema'

const spinner = ['🌍 ',	'🌎 ', '🌏 ']
const spinnerInterval = 500
const spinnerLength = spinner.length
const spinnerMessage = 'Generating i18n translation schema'
let config = vscode.workspace.getConfiguration('i18nTag')
let filter = config['filter'] || '\\.jsx?'
let srcPath = path.resolve(vscode.workspace.rootPath, config['src'] || '.')
let schema = path.resolve(vscode.workspace.rootPath, config['schema'] || './translation.schema.json')
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
        vscode.window.showInputBox({
            prompt: 'What is the source directory of your JS application?', 
            placeHolder: 'e.g. ./src',
            value: './src',
            validateInput: (val) => (!!val)?null:'Source directory setting is required!'
        }).then((srcProperty) => {
            vscode.window.showInputBox({
                prompt: 'What should be the name of your translation schema?', 
                placeHolder: 'e.g. ./translation.schema.json',
                value: './translation.schema.json',
            validateInput: (val) => (!!val)?null:'Schema path setting is required!'
            }).then((schemaProperty) => {
                vscode.window.showInputBox({
                    prompt: 'Only files that match this RegExp will be scanned!', 
                    placeHolder: 'e.g. \\.jsx?',
                    value: '\\.jsx?',
                    validateInput: (val) => (!!val)?null:'Extension RegEx setting is required!'
                }).then((filterProperty) => {
                    vscode.window.showInputBox({
                        prompt: 'Optional: Where are your translation files located?', 
                        placeHolder: 'e.g. /translations/**/*.json'
                    }).then((translationsProperty) => {
                        updateSettings(srcProperty, schemaProperty, filterProperty, translationsProperty)
                    })
                })
            })
        })
    })

    var updateSchemaCommand = vscode.commands.registerCommand('i18nTag.updateSchema', (context) => {
        updateSchema(context)
    })

    var showTranslationSchema = vscode.commands.registerCommand('i18nTag.showTranslationSchema', (context) => {
        vscode.workspace.openTextDocument(schema).then((file) => { 
            vscode.window.showTextDocument(file)
        }, (reason) => {
            vscode.window.showErrorMessage(reason)
        });
    })

    var showTranslationSchemaChanges = vscode.commands.registerCommand('i18nTag.showTranslationSchemaChanges', (context) => {
        if(oldSchema) {
            vscode.commands.executeCommand('vscode.diff', vscode.Uri.parse('i18n-schema:old.json'), vscode.Uri.parse(`i18n-schema:${path.basename(schema)}`)) 
        } else {
            vscode.window.showInformationMessage(`Schema has no local changes`)
        }
    })    

    let registration = vscode.workspace.registerTextDocumentContentProvider('i18n-schema', {
        provideTextDocumentContent(uri) {
            switch(uri.path) {
                case 'old.json':
                    return oldSchema
                default:
                    return new Promise((fulfill, reject) => {
                        vscode.workspace.openTextDocument(schema).then((file) => {        
                            fulfill(file.getText())
                        }, (reason) => {
                            reject(reason)
                        });
                    })
            }
        }
    })

    context.subscriptions.push(configureSchemaGenerator, updateSchemaCommand, showTranslationSchema, showTranslationSchemaChanges, registration)
}

function updateSettings(src: string, schm: string, filt: string, translations?: string) {    
    const settingsPath = path.resolve(vscode.workspace.rootPath, './.vscode/settings.json')

    fs.readFile(settingsPath, 'utf-8', (err, contents) => {
        if(err) {
            return;
        }
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
        fs.writeFile(settingsPath, JSON.stringify(settings, null, '\t'), 'utf-8', function (err) {
            filter = filt
	        srcPath = path.resolve(vscode.workspace.rootPath, src)
	        schema = path.resolve(vscode.workspace.rootPath, schm)
            if (err) {
                vscode.window.showInformationMessage(`Configuration of translation schema generator failed. ${err}`)
                return
            }
            vscode.window.showInformationMessage('Sucessfully configured translation schema generator')
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