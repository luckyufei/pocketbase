import type { DialogSchema, TabsSchema } from 'jamis';
import { defineSchema } from '../amis/schema';
import PocketBase, { CollectionModel, LocalAuthStore } from 'pocketbase';

let fromPb: PocketBase;
let toPb: PocketBase;

export const SyncPbSchema = defineSchema({
  type: 'page',
  id: 'syncPbPageId',
  title: '同步两个pocketbase中的数据',
  data: {
    fromPbReady: false
  },
  body: [
    {
      type: 'form',
      title: 'From PocketBase',
      columnCount: 3,
      mode: 'horizontal',
      panelClassName: 'max-w-3/5',
      api: {
        url: 'provider',
        async fetcherProvider(ctx, api) {
          console.log('🚀 ~ fetcherProvider ~ ctx:', ctx);
          fromPb = new PocketBase(ctx.url, new LocalAuthStore('from_pb'));
          const authStore = await fromPb.admins.authWithPassword(
            ctx.email,
            ctx.password
          );
          amisScoped.updateDataScope('syncPbPageId', { fromPbReady: true });
          return { data: authStore };
        }
      },
      body: [
        {
          type: 'input-url',
          name: 'url',
          label: 'URL',
          value: 'https://jamis.woa.com/pbdisk'
        },
        {
          type: 'input-email',
          label: 'EMAIL',
          name: 'email',
          required: true,
          value: 'allanyu@tencent.com'
        },
        {
          type: 'input-password',
          label: 'PASSWORD',
          name: 'password',
          value: 'Geek@523625'
        }
      ]
    },
    {
      type: 'service',
      visibleOn: '${fromPbReady}',
      schemaApi: {
        url: '',
        async fetcherProvider(ctx: any, api: any) {
          const collectionsList = await fromPb.collections.getFullList();
          return defineCollectionList(collectionsList);
        }
      }
    }
  ]
});

const defineCollectionList = (
  collectionsList: CollectionModel[]
): TabsSchema => {
  return {
    type: 'tabs',
    tabsMode: 'vertical',
    tabs: collectionsList.map((collection) => ({
      title: collection.name,
      icon: 'FolderOutlined',
      body: [
        {
          type: 'json',
          value: collection
        },
        {
          type: 'crud',
          data: {
            collection
          },
          filter: {
            type: 'form',
            wrapWithPanel: false,
            mode: 'vertical',
            body: [
              {
                type: 'textarea',
                name: 'filter',
                className: 'f:max-w-144',
                placeholder:
                  'Search term or filter like created > "2022-01-01"...'
              }
            ]
          },
          headerToolbar: [
            'statistics',
            {
              type: 'button',
              label: 'Sync Aother',
              icon: 'SyncOutlined',
              onEvent: {
                click: [
                  {
                    actionType: 'dialog',
                    dialog: defineSyncDialog()
                  },
                  {
                    actionType: 'log'
                  }
                ]
              }
            }
          ],
          columns: [
            {
              name: 'id',
              label: 'id',
              copyable: true,
              className: 'min-w-44'
            },
            ...(collection.type === 'auth'
              ? [
                  {
                    name: 'username',
                    label: 'username'
                  },
                  {
                    name: 'email',
                    label: 'email'
                  }
                ]
              : []),
            ...collection.schema.map((field) => ({
              name: field.name,
              label: field.name,
              type: field.type === 'json' ? 'json' : 'text',
              className: 'min-w-40'
            })),
            ...(collection.type !== 'view'
              ? [
                  {
                    icon: 'CalendarOutlined',
                    name: 'created',
                    label: 'created',
                    sortable: true
                  },
                  {
                    name: 'updated',
                    label: 'updated'
                  }
                ]
              : [])
          ],
          api: {
            url: 'provider',
            async fetcherProvider(ctx: any) {
              console.log('🚀 ~ getCollectionList ~ fetchProvider ~ ctx:', ctx);
              const records = await fromPb
                .collection(collection.id)
                .getList(ctx.page, ctx.perPage, {
                  sort: collection.type === 'base' ? '-created' : ''
                });
              console.log('🚀 ~ fetchProvider ~ records:', records);
              return { ...records, total: records.totalItems };
            }
          }
        }
      ]
    }))
  };
};

const defineSyncDialog = (): DialogSchema => {
  return {
    type: 'dialog',
    size: 'lg',
    title: 'Sync current pocketbase collection data to another pocketbase',
    debug: true,
    body: [
      {
        type: 'form',
        wrapWithPanel: false,
        id: 'syncCollectionFormId',
        data: {
          syncItems: 0
        },
        api: {
          url: 'provider',
          async fetcherProvider(ctx, api) {
            console.log('🚀 ~ fetcherProvider ~ ctx:', ctx);
            const toPb = new PocketBase(ctx.url, new LocalAuthStore('to_pb'));
            const authStore = await toPb.admins.authWithPassword(
              ctx.email,
              ctx.password
            );
            console.log('🚀 ~ fetcherProvider ~ authStore:', authStore);
            const fullList = await fromPb
              .collection(ctx.collection.id)
              .getFullList();
            console.log('🚀 ~ fetcherProvider ~ fullList:', fullList);
            toPb.collection(ctx.collection.id).create(ctx.collection);
            const fileFields = ctx.collection.schema.filter(
              (schemaItem: any) => schemaItem.type === 'file'
            ) as any[];
            console.log('🚀 ~ fetcherProvider ~ fileFields:', fileFields);
            for (let i = 0; i < fullList.length; i++) {
              const item = fullList[i];
              try {
                const savedItem = await toPb
                  .collection(ctx.collection.id)
                  .create({
                    ...item,
                    ...fileFields.reduce((acc, field) => {
                      acc[field.name] = undefined;
                      return acc;
                    }, {}),
                    ...(ctx.collection.type === 'auth'
                      ? {
                          password: 'jarvis123',
                          passwordConfirm: 'jarvis123'
                        }
                      : {})
                  });
                console.log('🚀 ~ fetcherProvider ~ savedItem:', savedItem);
                i > 0 &&
                  amisScoped.updateDataScope('syncCollectionFormId', {
                    syncItems: i
                  });
              } catch (err) {
                console.log(
                  '🚀 ~ fetcherProvider ~ err:',
                  err,
                  ', create item failed: ',
                  fullList[i]
                );
              }
            }
            return { code: 0, data: authStore };
          }
        },
        body: [
          {
            type: 'static-tpl',
            label: 'Collection',
            tpl: '${collection.name}',
            className: 'text-base font-bold text-primary'
          },
          {
            type: 'static',
            label: 'TOTAL ITEMS',
            name: 'totalItems'
          },
          {
            type: 'static',
            label: 'SYNC ITEMS',
            name: 'syncItems',
            visibleOn: '${syncItems > 0}'
          },
          {
            type: 'input-url',
            name: 'url',
            label: 'URL',
            value: 'https://dev-cjapi.woa.com/proxy/test-idc-jarvis/pb'
          },
          {
            type: 'input-email',
            label: 'EMAIL',
            name: 'email',
            required: true,
            value: 'allanyu@tencent.com'
          },
          {
            type: 'input-password',
            label: 'PASSWORD',
            name: 'password',
            required: true,
            value: 'Geek@523625'
          }
        ]
      }
    ]
  };
};
