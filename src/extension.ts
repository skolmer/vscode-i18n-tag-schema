"use strict";

import * as vscode from 'vscode';
import * as path from 'path';
import i18nTagSchema from 'i18n-tag-schema'

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('i18nTag');
    context.subscriptions.push(outputChannel);

    var updateSchemaCommand = vscode.commands.registerCommand('i18nTag.updateSchema', (context) => {
        updateSchema(context);
    });
    context.subscriptions.push(updateSchemaCommand);
}

function updateSchema(context: vscode.ExtensionContext) {
    let config = vscode.workspace.getConfiguration('i18nTag');
    const filter = config['filter'] || '\\.jsx?'
    const srcPath = path.resolve(vscode.workspace.rootPath, config['src'] || '.')
    const schema = path.resolve(vscode.workspace.rootPath, config['schema'] || './translation.schema.json')
    i18nTagSchema(srcPath, filter, schema, writeOutput)
}

function writeOutput(message: string) {
    outputChannel.appendLine(message);
}

export function deactivate() {
}