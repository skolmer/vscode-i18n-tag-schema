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

function updateSchema(context: vscode.ExtensionContext) {   
    const callback = (message: string, type: string = 'success') => {
        switch (type) {
            case 'success':
                if(message.indexOf('i18nTag json schema has been updated') > -1) {
                    var items = (oldSchema) ? ["Show Diff"] : []
                    vscode.window.showInformationMessage(message, ...items).then((value) => {
                        if(value === "Show Diff") {
                            vscode.commands.executeCommand('vscode.diff', vscode.Uri.parse('i18n-schema:old.json'), vscode.Uri.parse(`i18n-schema:${path.basename(schema)}`)) 
                        }
                    })
                } else {
                    vscode.window.showInformationMessage(message, "Show File").then((value) => {
                        if(value === "Show File") {
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