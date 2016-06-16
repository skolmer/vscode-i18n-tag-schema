"use strict";

import * as vscode from 'vscode';
import * as path from 'path';
import i18nTagSchema from 'i18n-tag-schema'

let outputChannel: vscode.OutputChannel
let oldSchema: string
let config = vscode.workspace.getConfiguration('i18nTag')
const filter = config['filter'] || '\\.jsx?'
const srcPath = path.resolve(vscode.workspace.rootPath, config['src'] || '.')
const schema = path.resolve(vscode.workspace.rootPath, config['schema'] || './translation.schema.json')
const spinner = ['🌍 ',	'🌎 ', '🌏 ']
const spinnerInterval = 80
const spinnerLength = spinner.length
const spinnerMessage = 'Generating i18n schema...'
let spinnerIndex = 0
let showSpinner = false
let spinnerInstance: vscode.StatusBarItem

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('i18nTag')
    context.subscriptions.push(outputChannel)

    var updateSchemaCommand = vscode.commands.registerCommand('i18nTag.updateSchema', (context) => {
        updateSchema(context)
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

    context.subscriptions.push(updateSchemaCommand, registration)
}

function spin(start) {
    showSpinner = start
    if(!showSpinner && spinnerInstance) {        
        spinnerInstance.dispose()
        spinnerInstance = undefined
    }
    if(showSpinner) {
        let char = spinner[spinnerIndex]      
        if(!spinnerInstance) {
            spinnerInstance = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, Number.MIN_VALUE)
            spinnerInstance.show()
        } 
        spinnerInstance.text = `${char} ${spinnerMessage}`
        
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