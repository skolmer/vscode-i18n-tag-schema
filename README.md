# vscode-i18n-tag-schema
![](images/vscode-18n-tag-schema-icon-big.jpg)

This extension genarates a json schema based on i18n tagged template strings in your javascript project
[[read more]](https://github.com/skolmer/es2015-i18n-tag)

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
   