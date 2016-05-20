"use strict";

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as escapeStringRegexp from 'escape-string-regexp';
import acorn from 'acorn-jsx';
import walk, { base } from 'acorn-jsx-walk';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel("i18nTag");
    context.subscriptions.push(outputChannel);

    var updateSchemaCommand = vscode.commands.registerCommand('extension.updateSchema', (context) => {
        updateSchema(context);
    });
    context.subscriptions.push(updateSchemaCommand);
}

function updateSchema(context: vscode.ExtensionContext) {
    let config = vscode.workspace.getConfiguration('i18nTag');
    const filter = config['filter'] || '\\.jsx?'
    const srcPath = path.resolve(vscode.workspace.rootPath, config['src'] || '.')
    let templates = [];
    let fileCount = 0, fileCountRead = 0;
    let readFiles = (dir) => fs.readdir(dir, (err, files) => {
        files.forEach((file, index) => {
            const filePath = path.resolve(dir, file)
            const ext = path.extname(file);
            let hasDir;
            if (ext.match(new RegExp(filter))) {
                fileCount++
                fs.readFile(filePath, 'utf-8', (err, contents) => {
                    templates.push(...inspectFile(contents))
                    fileCountRead++
                    if (fileCount === fileCountRead) {
                        saveSchema(templates)
                    }
                });
            }
            else {
                fs.stat(filePath, (err, stat) => {
                    if (stat && stat.isDirectory()) {
                        readFiles(filePath)
                    }
                });
            }
        });
    });

    readFiles(srcPath);
}

function saveSchema(templates) {
    if (templates && templates.length) {
        let config = vscode.workspace.getConfiguration('i18nTag');
        let json = JSON.parse(`{
            "type": "object",
            "properties": {
                ${templates.map(tmpl => `
                    ${JSON.stringify(tmpl)}: {
                        "type": "string"
                    }
                `)}
            },
            "additionalProperties": false
        }`);
        const jsonPath = path.resolve(vscode.workspace.rootPath, config['schema'] || './translation.schema.json')
        var prevJson
        if (fs.existsSync(jsonPath)) {
            try {
                prevJson = fs.readFileSync(jsonPath, 'utf-8')
            } catch (err) {
                writeOutput(err.message)
            }
        }
        fs.writeFile(jsonPath, JSON.stringify(json, null, '\t'), 'utf-8', function (err) {
            if (err) {
                return writeOutput(err.message);
            }

            var diff = jsonDiff(prevJson, json)
            writeOutput(`i18nTag json schema has been updated (${Object.keys(json.properties).length} keys  [${diff.added.length} added / ${diff.removed.length} removed]): ${jsonPath}`);
        })
    }
}

function jsonDiff(oldJson, newObj) {
    if (oldJson) {
        try {
            let oldKeys = Object.keys(JSON.parse(oldJson).properties)
            let newKeys = Object.keys(newObj.properties)
            let removed = oldKeys.filter((value, index) => newKeys.indexOf(value) === -1)
            let added = newKeys.filter((value, index) => oldKeys.indexOf(value) === -1)
            return { removed, added };
        } catch (err) {
            writeOutput(err.message)
        }
    }
    return { removed: [], added: Object.keys(newObj.properties) }
}


function inspectFile(contents) {
    const templateRegEx = /i18n`[^`]*`/g
    let matches = templateRegEx.exec(contents)
    let templates = []
    if (matches && matches.length) {
        let ev = (root) => {
            let source = root;
            walk(source, {
                TaggedTemplateExpression: (node) => {
                    if (node.tag.name === 'i18n') {
                        let match = source.substring(node.quasi.start + 1, node.quasi.end - 1);
                        let count = 0;
                        node.quasi.expressions.forEach(exp => {
                            let expression = source.substring(exp.start, exp.end)
                            let regExp = new RegExp(`\\\${${escapeStringRegexp(expression)}}(:([a-z])(\\((.+)\\))?)?`, "g")
                            match = match.replace(regExp, `\${${count}}`)
                            count++
                            ev(expression)
                        });
                        templates.push(match);
                    }
                },
            });
        };
        ev(contents);
    }
    return templates
}

function writeOutput(message: string) {
    outputChannel.appendLine(message);
}

export function deactivate() {
}