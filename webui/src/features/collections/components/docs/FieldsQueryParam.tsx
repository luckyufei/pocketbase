/**
 * FieldsQueryParam component
 * Fields query parameter documentation - renders as table row
 */
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'

export function FieldsQueryParam() {
  const { t } = useTranslation()

  return (
    <tr className="border-t">
      <td className="p-3 align-top font-mono text-sm">fields</td>
      <td className="p-3 align-top">
        <Badge variant="secondary" className="font-normal">
          String
        </Badge>
      </td>
      <td className="p-3 align-top text-sm">
        <p className="mb-2">
          {t('records.apiDocs.fieldsQueryParam.description', 'Comma separated string of the fields to return in the JSON response')}{' '}
          <em>({t('records.apiDocs.fieldsQueryParam.defaultNote', 'by default returns all fields')})</em>. {t('records.apiDocs.fieldsQueryParam.example', 'Ex.')}:
        </p>
        <code className="block bg-muted px-2 py-1 rounded text-xs mb-3 font-mono">
          ?fields=*,expand.relField.name
        </code>
        <p className="mb-1">
          <code className="text-primary">*</code> {t('records.apiDocs.fieldsQueryParam.asteriskNote', 'targets all keys from the specific depth level.')}
        </p>
        <p className="mb-2">
          {t('records.apiDocs.fieldsQueryParam.modifiersIntro', 'In addition, the following field modifiers are also supported:')}
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>
            <code className="font-mono text-xs">:excerpt(maxLength, withEllipsis?)</code>
            <br />
            <span className="text-muted-foreground ml-5">
              {t('records.apiDocs.fieldsQueryParam.excerptDesc', 'Returns a short plain text version of the field string value.')}
            </span>
            <br />
            <span className="text-muted-foreground ml-5">{t('records.apiDocs.fieldsQueryParam.example', 'Ex.')}:</span>
            <code className="block bg-muted px-2 py-1 rounded text-xs mt-1 ml-5 font-mono">
              ?fields=*,description:excerpt(200,true)
            </code>
          </li>
        </ul>
      </td>
    </tr>
  )
}
