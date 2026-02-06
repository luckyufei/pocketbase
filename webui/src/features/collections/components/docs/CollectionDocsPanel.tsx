/**
 * CollectionDocsPanel component
 * API documentation panel - integrates all API doc components
 */
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getCollectionTabs, type ApiDocsCollection } from '@/lib/apiDocsUtils'

// Import all API doc components
import { ListApiDocs } from './ListApiDocs'
import { ViewApiDocs } from './ViewApiDocs'
import { CreateApiDocs } from './CreateApiDocs'
import { UpdateApiDocs } from './UpdateApiDocs'
import { DeleteApiDocs } from './DeleteApiDocs'
import { RealtimeApiDocs } from './RealtimeApiDocs'
import { BatchApiDocs } from './BatchApiDocs'
import { AuthMethodsDocs } from './AuthMethodsDocs'
import { AuthWithPasswordDocs } from './AuthWithPasswordDocs'
import { AuthWithOAuth2Docs } from './AuthWithOAuth2Docs'
import { AuthWithOtpDocs } from './AuthWithOtpDocs'
import { AuthRefreshDocs } from './AuthRefreshDocs'
import { VerificationDocs } from './VerificationDocs'
import { PasswordResetDocs } from './PasswordResetDocs'
import { EmailChangeDocs } from './EmailChangeDocs'

interface CollectionDocsPanelProps {
  collection: ApiDocsCollection | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CollectionDocsPanel({ collection, open, onOpenChange }: CollectionDocsPanelProps) {
  const [activeTab, setActiveTab] = useState('list')

  const tabs = useMemo(() => {
    if (!collection) return []
    return getCollectionTabs(collection)
  }, [collection])

  // Base tabs count (used to add separator in auth collection)
  // BASE_TABS contains: list, view, create, update, delete, realtime, batch = 7
  const baseTabsCount = 7

  // Reset tab when collection changes
  useMemo(() => {
    if (tabs.length > 0 && !tabs.find((t) => t.id === activeTab)) {
      setActiveTab(tabs[0].id)
    }
  }, [tabs, activeTab])

  if (!collection) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[700px] sm:w-[900px] sm:max-w-none p-0">
        <div className="flex h-full">
          {/* Left vertical navigation */}
          <aside className="w-44 border-r bg-muted/30 flex flex-col">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-sm">API Preview</h2>
              <p className="text-xs text-muted-foreground mt-1 truncate">{collection.name}</p>
            </div>
            <ScrollArea className="flex-1">
              <nav className="p-2 space-y-1">
                <TooltipProvider>
                  {tabs.map((tab, index) => (
                    <div key={tab.id}>
                      {/* Add separator between base tabs and auth tabs in auth collection */}
                      {collection.type === 'auth' && index === baseTabsCount && (
                        <hr className="my-2 border-border" />
                      )}
                      {tab.disabled ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              disabled
                              className={cn(
                                'w-full text-left px-3 py-2 text-sm rounded-md',
                                'opacity-50 cursor-not-allowed text-slate-400'
                              )}
                            >
                              {tab.label}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Not enabled for the collection</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                            activeTab === tab.id
                              ? 'bg-blue-50 text-blue-600 font-medium'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          )}
                        >
                          {tab.label}
                        </button>
                      )}
                    </div>
                  ))}
                </TooltipProvider>
              </nav>
            </ScrollArea>
          </aside>

          {/* Right content area */}
          <div className="flex-1 flex flex-col min-w-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle className="text-base">
                {tabs.find((t) => t.id === activeTab)?.label || 'API Preview'}
              </SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1 p-4">
              <ApiDocContent collection={collection} action={activeTab} />
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// API doc content - renders the appropriate component based on action
interface ApiDocContentProps {
  collection: ApiDocsCollection
  action: string
}

function ApiDocContent({ collection, action }: ApiDocContentProps) {
  // Common props for all doc components
  const commonProps = {
    collection: collection as any,
    baseUrl: window.location.origin,
  }

  switch (action) {
    // Base collection tabs
    case 'list':
      return <ListApiDocs {...commonProps} />
    case 'view':
      return <ViewApiDocs {...commonProps} />
    case 'create':
      return <CreateApiDocs {...commonProps} />
    case 'update':
      return <UpdateApiDocs {...commonProps} />
    case 'delete':
      return <DeleteApiDocs {...commonProps} />
    case 'realtime':
      return <RealtimeApiDocs {...commonProps} />
    case 'batch':
      return <BatchApiDocs {...commonProps} />

    // Auth collection tabs
    case 'auth-methods':
      return <AuthMethodsDocs {...commonProps} />
    case 'auth-with-password':
      return <AuthWithPasswordDocs {...commonProps} />
    case 'auth-with-oauth2':
      return <AuthWithOAuth2Docs {...commonProps} />
    case 'auth-with-otp':
      return <AuthWithOtpDocs {...commonProps} />
    case 'auth-refresh':
      return <AuthRefreshDocs {...commonProps} />
    case 'verification':
      return <VerificationDocs {...commonProps} />
    case 'password-reset':
      return <PasswordResetDocs {...commonProps} />
    case 'email-change':
      return <EmailChangeDocs {...commonProps} />

    default:
      return (
        <div className="text-muted-foreground text-center py-8">
          Documentation for "{action}" is not available.
        </div>
      )
  }
}
