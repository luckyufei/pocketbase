import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getTokenPayload } from 'pocketbase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Loader2, ArrowRight, Upload } from 'lucide-react'
import { pb } from '@/lib/pocketbase'
import { toast } from 'sonner'
import { Confirmation } from '@/components/Confirmation'

export function InstallerPage() {
  const { t } = useTranslation()
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const emailInputRef = useRef<HTMLInputElement>(null)
  const backupFileInputRef = useRef<HTMLInputElement>(null)

  const isBusy = isLoading || isUploading

  useEffect(() => {
    checkToken()
  }, [token])

  async function checkToken() {
    if (!token) {
      navigate('/')
      return
    }

    setIsLoading(true)

    try {
      const payload = getTokenPayload(token)

      await pb.collection('_superusers').getOne(payload.id, {
        requestKey: 'installer_token_check',
        headers: { Authorization: token },
      })
    } catch (err: unknown) {
      const error = err as { isAbort?: boolean }
      if (!error?.isAbort) {
        toast.error('The installer token is invalid or has expired.')
        navigate('/')
      }
    }

    setIsLoading(false)
    emailInputRef.current?.focus()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isBusy) return

    setIsLoading(true)

    try {
      await pb.collection('_superusers').create(
        {
          email,
          password,
          passwordConfirm,
        },
        {
          headers: { Authorization: token! },
        }
      )

      await pb.collection('_superusers').authWithPassword(email, password)

      navigate('/')
    } catch (err) {
      console.error('Failed to create superuser:', err)
      toast.error('Failed to create superuser account.')
    }

    setIsLoading(false)
  }

  function resetSelectedBackupFile() {
    if (backupFileInputRef.current) {
      backupFileInputRef.current.value = ''
    }
    setPendingFile(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setPendingFile(file)
      setShowConfirm(true)
    }
  }

  async function uploadBackup() {
    if (!pendingFile || isBusy) return

    setShowConfirm(false)
    setIsUploading(true)

    try {
      await pb.backups.upload(
        { file: pendingFile },
        {
          headers: { Authorization: token! },
        }
      )

      await pb.backups.restore(pendingFile.name, {
        headers: { Authorization: token! },
      })

      toast.info('Please wait while extracting the uploaded archive!')

      // 乐观等待恢复完成
      await new Promise((r) => setTimeout(r, 2000))

      navigate('/')
    } catch (err) {
      console.error('Failed to upload backup:', err)
      toast.error('Failed to upload and restore backup.')
    }

    resetSelectedBackupFile()
    setIsUploading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            Create your first superuser account in order to continue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                ref={emailInputRef}
                id="email"
                type="email"
                autoComplete="off"
                disabled={isBusy}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                disabled={isBusy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Recommended at least 10 characters.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">
                Password confirm <span className="text-red-500">*</span>
              </Label>
              <Input
                id="passwordConfirm"
                type="password"
                minLength={10}
                disabled={isBusy}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isBusy}>
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create superuser and login
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <Separator className="my-6" />

          <div>
            <input
              ref={backupFileInputRef}
              id="backupFileInput"
              type="file"
              className="hidden"
              accept=".zip"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isBusy}
              onClick={() => backupFileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Or initialize from backup
            </Button>
          </div>
        </CardContent>
      </Card>

      <Confirmation
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Upload Backup"
        message={`Note that we don't perform validations for the uploaded backup files. Proceed with caution and only if you trust the file source.\n\nDo you really want to upload and initialize "${pendingFile?.name}"?`}
        onConfirm={uploadBackup}
        onCancel={resetSelectedBackupFile}
      />
    </div>
  )
}

export default InstallerPage
