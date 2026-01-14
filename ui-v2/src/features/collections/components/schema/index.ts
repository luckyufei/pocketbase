// 字段选项组件导出
export { TextFieldOptions, type TextField } from './TextFieldOptions'
export { NumberFieldOptions, type NumberField } from './NumberFieldOptions'
export { BoolFieldOptions, type BoolField } from './BoolFieldOptions'
export { EmailFieldOptions, type EmailField } from './EmailFieldOptions'
export { UrlFieldOptions, type UrlField } from './UrlFieldOptions'
export { EditorFieldOptions, type EditorField } from './EditorFieldOptions'
export { DateFieldOptions, type DateField } from './DateFieldOptions'
export { SelectFieldOptions, type SelectField } from './SelectFieldOptions'
export { JsonFieldOptions, type JsonField } from './JsonFieldOptions'
export { FileFieldOptions, type FileField } from './FileFieldOptions'
export { RelationFieldOptions, type RelationField } from './RelationFieldOptions'
export { PasswordFieldOptions, type PasswordField } from './PasswordFieldOptions'
export { AutodateFieldOptions, type AutodateField } from './AutodateFieldOptions'
export { GeoPointFieldOptions, type GeoPointField } from './GeoPointFieldOptions'

// 字段类型到组件的映射
export const FIELD_TYPE_OPTIONS: Record<string, React.ComponentType<any>> = {
  text: require('./TextFieldOptions').TextFieldOptions,
  number: require('./NumberFieldOptions').NumberFieldOptions,
  bool: require('./BoolFieldOptions').BoolFieldOptions,
  email: require('./EmailFieldOptions').EmailFieldOptions,
  url: require('./UrlFieldOptions').UrlFieldOptions,
  editor: require('./EditorFieldOptions').EditorFieldOptions,
  date: require('./DateFieldOptions').DateFieldOptions,
  select: require('./SelectFieldOptions').SelectFieldOptions,
  json: require('./JsonFieldOptions').JsonFieldOptions,
  file: require('./FileFieldOptions').FileFieldOptions,
  relation: require('./RelationFieldOptions').RelationFieldOptions,
  password: require('./PasswordFieldOptions').PasswordFieldOptions,
  autodate: require('./AutodateFieldOptions').AutodateFieldOptions,
  geoPoint: require('./GeoPointFieldOptions').GeoPointFieldOptions,
}
