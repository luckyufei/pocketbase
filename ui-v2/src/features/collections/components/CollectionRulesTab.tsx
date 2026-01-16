// T023: Collection API 规则编辑器 Tab
import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { RuleField } from './RuleField'

interface CollectionRulesData {
  id?: string
  name: string
  type: 'base' | 'auth' | 'view'
  system?: boolean
  fields?: Array<{ id?: string; name: string; type: string; hidden?: boolean; _toDelete?: boolean }>
  listRule?: string | null
  viewRule?: string | null
  createRule?: string | null
  updateRule?: string | null
  deleteRule?: string | null
  authRule?: string
  manageRule?: string | null
}

interface CollectionRulesTabProps {
  collection: CollectionRulesData
  onChange: (updates: Partial<CollectionRulesData>) => void
}

/**
 * Collection API 规则编辑器
 */
export function CollectionRulesTab({ collection, onChange }: CollectionRulesTabProps) {
  const [showFiltersInfo, setShowFiltersInfo] = useState(false)
  const [showExtraRules, setShowExtraRules] = useState(
    collection.manageRule !== null || (collection.authRule || '') !== ''
  )

  // 可用字段名（排除已删除和隐藏的）
  const fieldNames = useMemo(() => {
    return collection.fields?.filter((f) => !f._toDelete)?.map((f) => f.name) || []
  }, [collection.fields])

  // 隐藏字段名
  const hiddenFieldNames = useMemo(() => {
    return collection.fields?.filter((f) => f.hidden)?.map((f) => f.name) || []
  }, [collection.fields])

  // 可见字段名
  const visibleFieldNames = useMemo(() => {
    return fieldNames.filter((name) => !hiddenFieldNames.includes(name))
  }, [fieldNames, hiddenFieldNames])

  const isViewCollection = collection.type === 'view'
  const isAuthCollection = collection.type === 'auth'

  return (
    <div className="space-y-6">
      {/* 帮助信息 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <p>
            All rules follow the{' '}
            <a
              href="https://pocketbase.io/docs/api-rules-and-filters/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 font-semibold hover:underline"
            >
              PocketBase filter syntax and operators
            </a>
            .
          </p>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="text-slate-500"
            onClick={() => setShowFiltersInfo(!showFiltersInfo)}
          >
            {showFiltersInfo ? 'Hide available fields' : 'Show available fields'}
          </Button>
        </div>

        <Collapsible open={showFiltersInfo}>
          <CollapsibleContent>
            <Alert className="bg-slate-50 border-slate-200">
              <Info className="h-4 w-4 text-slate-500" />
              <AlertDescription className="text-sm space-y-3">
                <div>
                  <p className="font-medium mb-1 text-slate-900">
                    The following record fields are available:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {visibleFieldNames.map((name) => (
                      <Badge key={name} variant="outline" className="font-mono text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <hr className="border-slate-200" />

                <div>
                  <p className="font-medium mb-1 text-slate-900">
                    The request fields could be accessed with the special{' '}
                    <code className="bg-slate-100 px-1 rounded">@request</code> filter:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="font-mono text-xs">
                      @request.headers.*
                    </Badge>
                    <Badge variant="outline" className="font-mono text-xs">
                      @request.query.*
                    </Badge>
                    <Badge variant="outline" className="font-mono text-xs">
                      @request.body.*
                    </Badge>
                    <Badge variant="outline" className="font-mono text-xs">
                      @request.auth.*
                    </Badge>
                  </div>
                </div>

                <hr className="border-slate-200" />

                <div>
                  <p className="font-medium mb-1 text-slate-900">
                    You could also add constraints and query other collections using the{' '}
                    <code className="bg-slate-100 px-1 rounded">@collection</code> filter:
                  </p>
                  <Badge variant="outline" className="font-mono text-xs">
                    @collection.ANY_COLLECTION_NAME.*
                  </Badge>
                </div>

                <hr className="border-slate-200" />

                <div>
                  <p className="font-medium text-slate-900">Example rule:</p>
                  <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                    @request.auth.id != "" && created &gt; "2022-01-01 00:00:00"
                  </code>
                </div>
              </AlertDescription>
            </Alert>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* 基础规则 */}
      <div className="space-y-4">
        <RuleField
          label="List/Search rule"
          formKey="listRule"
          rule={collection.listRule ?? ''}
          onChange={(rule) => onChange({ listRule: rule })}
          collection={collection}
        />

        <RuleField
          label="View rule"
          formKey="viewRule"
          rule={collection.viewRule ?? ''}
          onChange={(rule) => onChange({ viewRule: rule })}
          collection={collection}
        />

        {/* View 类型不显示 Create/Update/Delete 规则 */}
        {!isViewCollection && (
          <>
            <RuleField
              label="Create rule"
              formKey="createRule"
              rule={collection.createRule ?? ''}
              onChange={(rule) => onChange({ createRule: rule })}
              collection={collection}
              helpText="The main record fields hold the values that are going to be inserted in the database."
            />

            <RuleField
              label="Update rule"
              formKey="updateRule"
              rule={collection.updateRule ?? ''}
              onChange={(rule) => onChange({ updateRule: rule })}
              collection={collection}
              helpText="The main record fields represent the old/existing record field values. To target the newly submitted ones you can use @request.body.*"
            />

            <RuleField
              label="Delete rule"
              formKey="deleteRule"
              rule={collection.deleteRule ?? ''}
              onChange={(rule) => onChange({ deleteRule: rule })}
              collection={collection}
            />
          </>
        )}
      </div>

      {/* Auth collection 额外规则 */}
      {isAuthCollection && (
        <>
          <hr />

          <Button
            type="button"
            variant={showExtraRules ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowExtraRules(!showExtraRules)}
          >
            <strong>Additional auth collection rules</strong>
            {showExtraRules ? (
              <ChevronUp className="h-4 w-4 ml-1" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-1" />
            )}
          </Button>

          <Collapsible open={showExtraRules}>
            <CollapsibleContent className="space-y-4">
              <RuleField
                label="Authentication rule"
                formKey="authRule"
                rule={collection.authRule ?? ''}
                onChange={(rule) => onChange({ authRule: rule ?? '' })}
                collection={collection}
                placeholder=""
                helpText={
                  <div className="space-y-1">
                    <p>
                      This rule is executed every time before authentication allowing you to
                      restrict who can authenticate.
                    </p>
                    <p>
                      For example, to allow only verified users you can set it to{' '}
                      <code>verified = true</code>.
                    </p>
                    <p>Leave it empty to allow anyone with an account to authenticate.</p>
                  </div>
                }
              />

              <RuleField
                label="Manage rule"
                formKey="manageRule"
                rule={collection.manageRule ?? null}
                onChange={(rule) => onChange({ manageRule: rule })}
                collection={collection}
                placeholder=""
                required={collection.manageRule !== null}
                helpText={
                  <div className="space-y-1">
                    <p>
                      This rule is executed in addition to the <code>create</code> and{' '}
                      <code>update</code> API rules.
                    </p>
                    <p>
                      It enables superuser-like permissions to allow fully managing the auth
                      record(s), eg. changing the password without requiring to enter the old one,
                      directly updating the verified state or email, etc.
                    </p>
                  </div>
                }
              />
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  )
}

export default CollectionRulesTab
