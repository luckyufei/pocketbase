import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'
import { FieldsQueryParam } from './FieldsQueryParam'
import { getApiExampleUrl } from '@/lib/api-utils'
import { pb } from '@/lib/pocketbase'
import type { Collection } from '@/types'

interface AuthMethodsDocsProps {
  collection: Collection
}

export function AuthMethodsDocs({ collection }: AuthMethodsDocsProps) {
  const { t } = useTranslation()
  const [responseTab, setResponseTab] = useState('200')
  const [authMethods, setAuthMethods] = useState<Record<string, unknown>>({})
  const [isLoading, setIsLoading] = useState(false)

  const backendAbsUrl = getApiExampleUrl(pb.baseURL)

  useEffect(() => {
    async function listAuthMethods() {
      setIsLoading(true)
      try {
        const methods = await pb.collection(collection.name).listAuthMethods()
        setAuthMethods(methods)
      } catch (err) {
        console.error('Failed to load auth methods:', err)
      }
      setIsLoading(false)
    }
    listAuthMethods()
  }, [collection.name])

  const responses = [
    {
      code: '200',
      body: isLoading ? '...' : JSON.stringify(authMethods, null, 2),
    },
    {
      code: '404',
      body: `{
  "status": 404,
  "message": "Missing collection context.",
  "data": {}
}`,
    },
  ]

  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${backendAbsUrl}');

...

const result = await pb.collection('${collection.name}').listAuthMethods();`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${backendAbsUrl}');

...

final result = await pb.collection('${collection.name}').listAuthMethods();`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">List auth methods ({collection.name})</h3>
        <p className="text-muted-foreground">
          Returns a public list with all allowed <strong>{collection.name}</strong> authentication
          methods.
        </p>
      </div>

      <SdkTabs jsCode={jsCode} dartCode={dartCode} />

      <div>
        <h6 className="font-medium mb-2">API details</h6>
        <div className="rounded-md border bg-blue-50 dark:bg-blue-950 p-3">
          <Badge variant="default" className="mr-2">
            GET
          </Badge>
          <code className="text-sm">
            /api/collections/<strong>{collection.name}</strong>/auth-methods
          </code>
        </div>
      </div>

      <div>
        <h6 className="font-medium mb-2">Query parameters</h6>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium">Param</th>
                <th className="text-left p-2 font-medium">Type</th>
                <th className="text-left p-2 font-medium w-1/2">Description</th>
              </tr>
            </thead>
            <tbody>
              <FieldsQueryParam />
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h6 className="font-medium mb-2">Responses</h6>
        <Tabs value={responseTab} onValueChange={setResponseTab}>
          <TabsList>
            {responses.map((response) => (
              <TabsTrigger key={response.code} value={response.code}>
                {response.code}
              </TabsTrigger>
            ))}
          </TabsList>
          {responses.map((response) => (
            <TabsContent key={response.code} value={response.code}>
              <CodeBlock content={response.body} language="json" />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
