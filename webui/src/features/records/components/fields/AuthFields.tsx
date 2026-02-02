/**
 * AuthFields - Auth Collection 专用字段组件
 * 包含 email、emailVisibility、password、passwordConfirm、verified
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CollectionModel } from 'pocketbase'

interface AuthFieldsProps {
  record: Record<string, unknown>
  onChange: (field: string, value: unknown) => void
  collection: CollectionModel
  isNew: boolean
}

export function AuthFields({ record, onChange, collection, isNew }: AuthFieldsProps) {
  const { t } = useTranslation()
  const [changePasswordToggle, setChangePasswordToggle] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)

  const isSuperusers = collection?.name === '_superusers'

  // 找到 email 字段配置
  const emailField = collection?.fields?.find((f) => f.name === 'email')
  const emailRequired = emailField?.required ?? true

  return (
    <div className="space-y-4">
      {/* Email 字段 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="email">
            email
            {emailRequired && <span className="text-destructive ml-1">*</span>}
          </Label>
          {!isSuperusers && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'h-6 text-xs',
                record.emailVisibility ? 'text-green-600' : 'text-muted-foreground'
              )}
              onClick={() => onChange('emailVisibility', !record.emailVisibility)}
            >
              Public: {record.emailVisibility ? 'On' : 'Off'}
            </Button>
          )}
        </div>
        <Input
          id="email"
          type="email"
          autoFocus={isNew}
          autoComplete="off"
          required={emailRequired}
          value={(record.email as string) || ''}
          onChange={(e) => onChange('email', e.target.value)}
          placeholder="email@example.com"
        />
      </div>

      {/* 密码切换（编辑模式） */}
      {!isNew && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="change-password"
            checked={changePasswordToggle}
            onCheckedChange={(checked) => {
              setChangePasswordToggle(!!checked)
              if (!checked) {
                // 清空密码字段
                onChange('password', undefined)
                onChange('passwordConfirm', undefined)
              }
            }}
          />
          <Label htmlFor="change-password" className="text-sm font-normal cursor-pointer">
            {t('records.changePassword', 'Change password')}
          </Label>
        </div>
      )}

      {/* 密码字段（新建模式或切换开启） */}
      {(isNew || changePasswordToggle) && (
        <div className="grid grid-cols-2 gap-4">
          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">
              <Lock className="inline h-3 w-3 mr-1" />
              Password
              <span className="text-destructive ml-1">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={(record.password as string) || ''}
                onChange={(e) => onChange('password', e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Password Confirm */}
          <div className="space-y-2">
            <Label htmlFor="passwordConfirm">
              <Lock className="inline h-3 w-3 mr-1" />
              Password confirm
              <span className="text-destructive ml-1">*</span>
            </Label>
            <div className="relative">
              <Input
                id="passwordConfirm"
                type={showPasswordConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={(record.passwordConfirm as string) || ''}
                onChange={(e) => onChange('passwordConfirm', e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
              >
                {showPasswordConfirm ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Verified 字段（非 superusers） */}
      {!isSuperusers && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="verified"
            checked={!!record.verified}
            onCheckedChange={(checked) => onChange('verified', !!checked)}
          />
          <Label htmlFor="verified" className="text-sm font-normal cursor-pointer">
            Verified
          </Label>
        </div>
      )}
    </div>
  )
}

export default AuthFields
