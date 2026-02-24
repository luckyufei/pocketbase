/**
 * Admins Settings 页面
 * 管理员账户管理
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Plus, Trash2, Edit } from 'lucide-react'
import { getApiClient } from '@/lib/ApiClient'

interface Admin {
  id: string
  email: string
  created: string
  updated: string
}

export function Admins() {
  const { t } = useTranslation()
  const [admins, setAdmins] = useState<Admin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null)
  const [formData, setFormData] = useState({ email: '', password: '', passwordConfirm: '' })
  const [isSaving, setIsSaving] = useState(false)

  const pb = getApiClient()

  const loadAdmins = async () => {
    setIsLoading(true)
    try {
      const list = await pb.admins.getFullList()
      setAdmins(list || [])
    } catch (err) {
      console.error('Failed to load admins:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAdmins()
  }, [])

  const openCreateDialog = () => {
    setEditingAdmin(null)
    setFormData({ email: '', password: '', passwordConfirm: '' })
    setIsDialogOpen(true)
  }

  const openEditDialog = (admin: Admin) => {
    setEditingAdmin(admin)
    setFormData({ email: admin.email, password: '', passwordConfirm: '' })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      if (editingAdmin) {
        await pb.admins.update(editingAdmin.id, formData)
      } else {
        await pb.admins.create(formData)
      }
      await loadAdmins()
      setIsDialogOpen(false)
    } catch (err) {
      console.error('Failed to save admin:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const deleteAdmin = async (admin: Admin) => {
    if (!confirm(t('settingsPage.admins.deleteConfirm', { email: admin.email }))) {
      return
    }
    try {
      await pb.admins.delete(admin.id)
      await loadAdmins()
    } catch (err) {
      console.error('Failed to delete admin:', err)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Page header */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>{t('settingsPage.breadcrumbSettings')}</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">{t('settingsPage.admins.breadcrumb')}</span>
        </nav>
      </header>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          {t('settingsPage.admins.newAdmin')}
        </Button>
      </div>

      {/* Admin list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t('settingsPage.admins.noAdmins')}</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('settingsPage.admins.emailColumn')}</TableHead>
              <TableHead>{t('settingsPage.admins.createdColumn')}</TableHead>
              <TableHead>{t('settingsPage.admins.updatedColumn')}</TableHead>
              <TableHead className="w-24">{t('settingsPage.admins.actionsColumn')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell>{admin.email}</TableCell>
                <TableCell>{formatDate(admin.created)}</TableCell>
                <TableCell>{formatDate(admin.updated)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(admin)}
                      title={t('common.edit')}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteAdmin(admin)}
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAdmin ? t('settingsPage.admins.editTitle') : t('settingsPage.admins.newTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('settingsPage.admins.emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                {t('settingsPage.admins.passwordLabel')} {editingAdmin && t('settingsPage.admins.passwordKeepHint')}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">{t('settingsPage.admins.confirmPasswordLabel')}</Label>
              <Input
                id="passwordConfirm"
                type="password"
                value={formData.passwordConfirm}
                onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                required={!editingAdmin}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>
                {t('settingsPage.admins.cancel')}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingAdmin ? t('settingsPage.admins.save') : t('settingsPage.admins.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Admins
