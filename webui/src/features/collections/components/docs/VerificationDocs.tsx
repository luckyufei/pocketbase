import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  UnderlineTabsList,
  UnderlineTabsTrigger,
} from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'
import { getApiExampleUrl } from '@/lib/api-utils'
import { pb } from '@/lib/pocketbase'
import type { Collection } from '@/types'

interface VerificationDocsProps {
  collection: Collection
}

function VerificationApiRequestDocs({ collection }: { collection: Collection }) {
  const [responseTab, setResponseTab] = useState('204')

  const responses = [
    {
      code: '204',
      body: 'null',
    },
    {
      code: '400',
      body: `{
  "status": 400,
  "message": "An error occurred while validating the submitted data.",
  "data": {
    "email": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
}`,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-green-50 dark:bg-green-950 p-3">
        <Badge variant="default" className="mr-2 bg-green-600">
          POST
        </Badge>
        <code className="text-sm">
          /api/collections/<strong>{collection.name}</strong>/request-verification
        </code>
      </div>

      <div>
        <h6 className="font-medium mb-2">Body Parameters</h6>
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
              <tr className="border-t">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                      Required
                    </Badge>
                    <span>email</span>
                  </div>
                </td>
                <td className="p-2">
                  <Badge variant="outline">String</Badge>
                </td>
                <td className="p-2 text-muted-foreground">
                  The auth record email address to send the verification request (if exists).
                </td>
              </tr>
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

function VerificationApiConfirmDocs({ collection }: { collection: Collection }) {
  const [responseTab, setResponseTab] = useState('204')

  const responses = [
    {
      code: '204',
      body: 'null',
    },
    {
      code: '400',
      body: `{
  "status": 400,
  "message": "An error occurred while validating the submitted data.",
  "data": {
    "token": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
}`,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-green-50 dark:bg-green-950 p-3">
        <Badge variant="default" className="mr-2 bg-green-600">
          POST
        </Badge>
        <code className="text-sm">
          /api/collections/<strong>{collection.name}</strong>/confirm-verification
        </code>
      </div>

      <div>
        <h6 className="font-medium mb-2">Body Parameters</h6>
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
              <tr className="border-t">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                      Required
                    </Badge>
                    <span>token</span>
                  </div>
                </td>
                <td className="p-2">
                  <Badge variant="outline">String</Badge>
                </td>
                <td className="p-2 text-muted-foreground">
                  The token from the verification request email.
                </td>
              </tr>
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

export function VerificationDocs({ collection }: VerificationDocsProps) {
  const { t } = useTranslation()
  const [activeApiTab, setActiveApiTab] = useState('request')
  const backendAbsUrl = getApiExampleUrl(pb.baseURL)

  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${backendAbsUrl}');

...

await pb.collection('${collection.name}').requestVerification('test@example.com');

// ---
// (optional) in your custom confirmation page:
// ---

await pb.collection('${collection.name}').confirmVerification('VERIFICATION_TOKEN');`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${backendAbsUrl}');

...

await pb.collection('${collection.name}').requestVerification('test@example.com');

// ---
// (optional) in your custom confirmation page:
// ---

await pb.collection('${collection.name}').confirmVerification('VERIFICATION_TOKEN');`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Account verification ({collection.name})</h3>
        <p className="text-muted-foreground">
          Sends <strong>{collection.name}</strong> account verification request.
        </p>
      </div>

      <SdkTabs js={jsCode} dart={dartCode} />

      <div>
        <h6 className="font-medium mb-2">API details</h6>
        <Tabs value={activeApiTab} onValueChange={setActiveApiTab}>
          <UnderlineTabsList>
            <UnderlineTabsTrigger value="request">Request verification</UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="confirm">Confirm verification</UnderlineTabsTrigger>
          </UnderlineTabsList>
          <TabsContent value="request">
            <VerificationApiRequestDocs collection={collection} />
          </TabsContent>
          <TabsContent value="confirm">
            <VerificationApiConfirmDocs collection={collection} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
