# vscode-18n-tag-schema
![](images/vscode-18n-tag-schema-icon-big.jpg)

* Inspired by [i18n with tagged template strings in ECMAScript 6](http://jaysoo.ca/2014/03/20/i18n-with-es6-template-strings/)

This extension genarates a json schema based on i18n tagged template strings in your javascript project

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
   }
```
   