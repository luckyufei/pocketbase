/**
 * RealtimeApiDocs component
 * Realtime API documentation
 */
import { SdkTabs } from './SdkTabs'
import { ResponseTabs } from './ResponseTabs'

interface Collection {
  id: string
  name: string
  type: string
}

interface RealtimeApiDocsProps {
  collection: Collection
  baseUrl?: string
}

export function RealtimeApiDocs({
  collection,
  baseUrl = 'http://127.0.0.1:8090',
}: RealtimeApiDocsProps) {
  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl}');

...

// (Optionally) authenticate
await pb.collection('${collection.name}').authWithPassword('test@example.com', '123456');

// Subscribe to changes in any ${collection.name} record
pb.collection('${collection.name}').subscribe('*', function (e) {
    console.log(e.action);
    console.log(e.record);
}, { /* other options like: filter, expand, custom headers, etc. */ });

// Subscribe to changes only in the specified record
pb.collection('${collection.name}').subscribe('RECORD_ID', function (e) {
    console.log(e.action);
    console.log(e.record);
}, { /* other options like: filter, expand, custom headers, etc. */ });

// Unsubscribe
pb.collection('${collection.name}').unsubscribe('RECORD_ID'); // remove all 'RECORD_ID' subscriptions
pb.collection('${collection.name}').unsubscribe('*'); // remove all '*' topic subscriptions
pb.collection('${collection.name}').unsubscribe(); // remove all subscriptions in the collection`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${baseUrl}');

...

// (Optionally) authenticate
await pb.collection('${collection.name}').authWithPassword('test@example.com', '123456');

// Subscribe to changes in any ${collection.name} record
pb.collection('${collection.name}').subscribe('*', (e) {
    print(e.action);
    print(e.record);
}, /* other options like: filter, expand, custom headers, etc. */);

// Subscribe to changes only in the specified record
pb.collection('${collection.name}').subscribe('RECORD_ID', (e) {
    print(e.action);
    print(e.record);
}, /* other options like: filter, expand, custom headers, etc. */);

// Unsubscribe
pb.collection('${collection.name}').unsubscribe('RECORD_ID'); // remove all 'RECORD_ID' subscriptions
pb.collection('${collection.name}').unsubscribe('*'); // remove all '*' topic subscriptions
pb.collection('${collection.name}').unsubscribe(); // remove all subscriptions in the collection`

  const eventDataResponse = [
    {
      code: 200,
      body: `{
  "action": "create", // create, update or delete
  "record": {
    "collectionId": "${collection.id}",
    "collectionName": "${collection.name}",
    "id": "test",
    "email": "test@example.com",
    "emailVisibility": true,
    "verified": true,
    "name": "test",
    "avatar": "filename.jpg",
    "created": "2022-01-01 10:00:00.123Z",
    "updated": "2022-01-01 10:00:00.123Z"
  }
}`,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Title and description */}
      <div>
        <h3 className="text-lg font-medium mb-2">Realtime ({collection.name})</h3>
        <p className="text-muted-foreground mb-3">
          Subscribe to realtime changes via Server-Sent Events (SSE).
        </p>
        <p className="text-muted-foreground">
          Events are sent for <strong>create</strong>, <strong>update</strong> and <strong>delete</strong> record operations (see "Event data format" section below).
        </p>
      </div>

      {/* Info notice about ViewRule and ListRule */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm mb-2">
          <span className="inline-block mr-1 text-blue-600">ℹ</span>
          <strong>You could subscribe to a single record or to an entire collection.</strong>
        </p>
        <ul className="text-sm list-disc list-inside space-y-1 ml-5">
          <li>
            When you subscribe to a <strong>single record</strong>, the collection's <strong>ViewRule</strong> will be used to determine whether the subscriber has access to receive the event message.
          </li>
          <li>
            When you subscribe to an <strong>entire collection</strong>, the collection's <strong>ListRule</strong> will be used to determine whether the subscriber has access to receive the event message.
          </li>
        </ul>
      </div>

      {/* SDK code examples */}
      <SdkTabs js={jsCode} dart={dartCode} />

      {/* API details */}
      <div>
        <h4 className="text-sm font-medium mb-2">API details</h4>
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">
            SSE
          </span>
          <span className="font-mono text-sm">/api/realtime</span>
        </div>
      </div>

      {/* Event data format */}
      <div>
        <h4 className="text-sm font-medium mb-3">Event data format</h4>
        <ResponseTabs responses={eventDataResponse} showTabs={false} />
      </div>
    </div>
  )
}
