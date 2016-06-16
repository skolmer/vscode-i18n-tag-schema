"use strict";

import * as vscode from 'vscode';
import * as path from 'path';
import i18nTagSchema from 'i18n-tag-schema'

let oldSchema: string
let config = vscode.workspace.getConfiguration('i18nTag')
const filter = config['filter'] || '\\.jsx?'
const srcPath = path.resolve(vscode.workspace.rootPath, config['src'] || '.')
const schema = path.resolve(vscode.workspace.rootPath, config['schema'] || './translation.schema.json')

export function activate(context: vscode.ExtensionContext) {
    var updateSchemaCommand = vscode.commands.registerCommand('i18nTag.updateSchema', (context) => {
        updateSchema(context)
    })

    let registration = vscode.workspace.registerTextDocumentContentProvider('i18n-schema', {
        provideTextDocumentContent(uri) {
            return oldSchema
        }
    })

    context.subscriptions.push(updateSchemaCommand, registration)
}

function updateSchema(context: vscode.ExtensionContext) {   
    const callback = (message: string) => {
        var items = (oldSchema) ? ["Show Diff"] : []
        vscode.window.showInformationMessage(message, ...items).then((value) => {
            if(value === "Show Diff") {
                vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(schema), vscode.Uri.parse('i18n-schema:old.schema.json')) 
            }
        })
        
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