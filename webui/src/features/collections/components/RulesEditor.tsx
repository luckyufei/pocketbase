/**
 * RulesEditor - Collection 规则编辑器
 * 用于编辑 Collection 的访问规则（List, View, Create, Update, Delete）
 */
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, Unlock } from 'lucide-react'

interface Rules {
  listRule: string | null
  viewRule: string | null
  createRule: string | null
  updateRule: string | null
  deleteRule: string | null
}

interface RulesEditorProps {
  rules: Rules
  onChange: (rules: Rules) => void
}

const RULE_TYPES = [
  { key: 'listRule', label: 'List', description: 'Filter for listing records' },
  { key: 'viewRule', label: 'View', description: 'Filter for viewing a single record' },
  { key: 'createRule', label: 'Create', description: 'Filter for creating records' },
  { key: 'updateRule', label: 'Update', description: 'Filter for updating records' },
  { key: 'deleteRule', label: 'Delete', description: 'Filter for deleting records' },
] as const

export function RulesEditor({ rules, onChange }: RulesEditorProps) {
  const updateRule = (key: keyof Rules, value: string | null) => {
    onChange({ ...rules, [key]: value })
  }

  const toggleLock = (key: keyof Rules) => {
    const currentValue = rules[key]
    // null = 锁定（只有管理员可访问）
    // '' = 解锁（所有人可访问）
    updateRule(key, currentValue === null ? '' : null)
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Define access rules using filter expressions. Leave empty to allow all access, or lock to
        restrict to admins only.
      </div>

      {RULE_TYPES.map(({ key, label, description }) => {
        const isLocked = rules[key] === null
        const value = rules[key] ?? ''

        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>{label}</Label>
                {isLocked && (
                  <Badge variant="secondary" className="text-xs">
                    Admin Only
                  </Badge>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => toggleLock(key)}
                title={isLocked ? 'Unlock' : 'Lock (Admin only)'}
              >
                {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              </Button>
            </div>

            <Textarea
              value={isLocked ? '' : value}
              onChange={(e) => updateRule(key, e.target.value)}
              disabled={isLocked}
              placeholder={isLocked ? 'Locked - Admin only' : `e.g., @request.auth.id != ""`}
              className="font-mono text-sm"
              rows={2}
            />

            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        )
      })}
    </div>
  )
}
