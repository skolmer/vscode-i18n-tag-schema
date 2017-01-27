### 2.2.0

* Updated to i18n-tag-schema v2.4.0
* Added support for custom import names. import x, { i18nGroup as y } from 'es2015-i18n-tag' is now detected by i18n-tag-schema.
* Added support for custom postprocessors like a PO translation format export.
* Qdded indention option. This allows you to use spaces instead of tabs in the generated schema.
* Fix: empty strings should not be exported as keys

### 2.1.1

* Optimized logging output
* Fixed an issue where context menu commands are not executed on the selected file

### 2.1.0

* Added support for custom preprocessors
* Added typescript support. 🎉 Set the preprocessor configuration to ./preprocessors/typescript and the filter to \\.tsx? if you are using typescript syntax.
* Added babylonConfig option to override default parser options

### 2.0.0

* Updated to i18n-tag-schema v2.0.5