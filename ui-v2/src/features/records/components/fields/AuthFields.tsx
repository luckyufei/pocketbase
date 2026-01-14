/**
 * 认证字段组组件
 * 用于展示和编辑认证集合的特殊字段（邮箱、密码、验证状态等）
 */
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { PasswordField } from './PasswordField'
import type { RecordModel } from 'pocketbase'

interface AuthFieldsProps {
  record: RecordModel
  onChange: (field: string, value: unknown) => void
  errors?: Record<string, string>
  isNew?: boolean
}

export function AuthFields({ record, onChange, errors = {}, isNew = false }: AuthFieldsProps) {
  return (
    <div className="space-y-4">
      {/* 用户名 */}
      <div className="space-y-2">
        <Label htmlFor="username">用户名</Label>
        <Input
          id="username"
          value={record.username || ''}
          onChange={(e) => onChange('username', e.target.value)}
          placeholder="输入用户名"
          className={errors.username ? 'border-destructive' : ''}
        />
        {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
      </div>

      {/* 邮箱 */}
      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <div className="flex items-center gap-2">
          <Input
            id="email"
            type="email"
            value={record.email || ''}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="输入邮箱地址"
            className={`flex-1 ${errors.email ? 'border-destructive' : ''}`}
          />
          {!isNew && record.verified && <Badge variant="default">已验证</Badge>}
          {!isNew && !record.verified && record.email && <Badge variant="secondary">未验证</Badge>}
        </div>
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
      </div>

      {/* 邮箱可见性 */}
      <div className="flex items-center justify-between">
        <Label htmlFor="emailVisibility">邮箱可见性</Label>
        <Switch
          id="emailVisibility"
          checked={record.emailVisibility || false}
          onCheckedChange={(checked) => onChange('emailVisibility', checked)}
        />
      </div>

      {/* 密码 */}
      <div className="space-y-2">
        <Label htmlFor="password">{isNew ? '密码' : '新密码'}</Label>
        <PasswordField
          value={record.password || ''}
          onChange={(value) => onChange('password', value)}
          placeholder={isNew ? '输入密码' : '留空保持不变'}
          error={errors.password}
          showStrength
        />
      </div>

      {/* 确认密码 */}
      <div className="space-y-2">
        <Label htmlFor="passwordConfirm">确认密码</Label>
        <PasswordField
          value={record.passwordConfirm || ''}
          onChange={(value) => onChange('passwordConfirm', value)}
          placeholder="再次输入密码"
          error={errors.passwordConfirm}
        />
      </div>

      {/* 验证状态（仅编辑时显示） */}
      {!isNew && (
        <div className="flex items-center justify-between">
          <Label htmlFor="verified">已验证</Label>
          <Switch
            id="verified"
            checked={record.verified || false}
            onCheckedChange={(checked) => onChange('verified', checked)}
          />
        </div>
      )}
    </div>
  )
}
