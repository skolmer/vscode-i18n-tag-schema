# vscode-i18n-tag-schema
![](images/vscode-18n-tag-schema-icon-big.jpg)

This [extension](https://marketplace.visualstudio.com/items?itemName=skolmer.vscode-i18n-tag-schema) genarates a json schema based on i18n tagged template strings in your javascript project
[[es2015-i18n-tag]](https://github.com/skolmer/es2015-i18n-tag)

###.vscode/settings.json
```json
    "i18nTag.src": "./src",
	"i18nTag.schema": "./translation.schema.json",
	"i18nTag.filter": ".jsx?"
    "json.schemas": [
        {
            "fileMatch": [
                "/src/i18n/*.json"
            ],
            "url": "./translation.schema.json"
        },
        ..
    ]
```
   
### Use
Run command `i18nTag: Update translation schema` to generate a new translation schema.

### Reference schema in translation.json file
```json
{
    "$schema": "./translation.schema.json",
    "key": "value"
}
```
