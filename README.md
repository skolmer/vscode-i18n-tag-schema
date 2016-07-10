# i18n Tagged Template Literals Schema [![Marketplace Version](https://vsmarketplacebadge.apphb.com/version-short/skolmer.vscode-i18n-tag-schema.svg)](https://marketplace.visualstudio.com/items?itemName=skolmer.vscode-i18n-tag-schema) ![Marketplace Downloads](https://vsmarketplacebadge.apphb.com/installs/skolmer.vscode-i18n-tag-schema.svg)
[![i18n Tagged Template Literals](https://github.com/skolmer/vscode-i18n-tag-schema/raw/master/images/vscode-18n-tag-schema-icon-big.jpg)](http://i18n-tag.kolmer.net/)

This [Visual Studio Code Extension](https://marketplace.visualstudio.com/items?itemName=skolmer.vscode-i18n-tag-schema) genarates a json schema based on [i18n tagged template literals](https://github.com/skolmer/es2015-i18n-tag) in your javascript project.

For more details please see: [Template Literal based i18n translation and localization](http://i18n-tag.kolmer.net/)

[![i18n Tagged Template Literals Schema Extension](https://github.com/skolmer/vscode-i18n-tag-schema/raw/master/images/demo.gif)](https://marketplace.visualstudio.com/items?itemName=skolmer.vscode-i18n-tag-schema)

## .vscode/settings.json
For quick configuration use `i18nTag: Configure translation schema generator` command

```json
    "i18nTag.src": "./src",
    "i18nTag.schema": "./translation.schema.json",
    "i18nTag.filter": "\\.jsx?$",
    "i18nTag.grouped": false
    "json.schemas": [
        {
            "fileMatch": [
                "/src/i18n/*.json"
            ],
            "url": "./translation.schema.json"
        }
    ]
```
   
## Use
* Run command `i18nTag: Update translation schema` to generate a new translation schema.
* Run command `i18nTag: Show translation schema` to show the current translation schema.
* Run command `i18nTag: Show last local change to translation schema` to show the last local change of translation schema.
* Run command `i18nTag: List all template literals of current file` to list all template literals of the current active JavaScript file.

## Reference schema in individual JSON file
If you don't set the translation directory in configuration you can reference the schema directly in your json file.
```json
{
    "$schema": "./translation.schema.json",
    "key": "value"
}
```

## Tools


### Run time translation and localization
* [es2015-i18n-tag](https://github.com/skolmer/es2015-i18n-tag): ES2015 template literal tag for i18n and l10n (translation and internationalization) using Intl [![npm version](https://img.shields.io/npm/v/es2015-i18n-tag.svg?style=flat)](https://www.npmjs.com/package/es2015-i18n-tag)

### Build time translation
* [babel-plugin-i18n-tag-translate](https://github.com/skolmer/babel-plugin-i18n-tag-translate): Translate your template literals at build time or add filename groups [![npm version](https://img.shields.io/npm/v/babel-plugin-i18n-tag-translate.svg?style=flat)](https://www.npmjs.com/package/babel-plugin-i18n-tag-translate)

### Schema based translations
* [i18n-tag-schema](https://github.com/skolmer/i18n-tag-schema): JSON Schema based translation validation and tools [![npm version](https://img.shields.io/npm/v/i18n-tag-schema.svg?style=flat)](https://www.npmjs.com/package/i18n-tag-schema)

## License

Copyright (c) 2016 Steffen Kolmer

This software is licensed under the MIT license.  See the `LICENSE` file
accompanying this software for terms of use.
