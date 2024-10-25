import { SchemaObject } from 'jamis';
import { pb } from '../libs/pocketbase';

export const InterfacesPage: SchemaObject = {
  type: 'page',
  bodyClassName: 'flex gap-x-3',
  id: 'interfacesPageId',
  data: {
    interfaceCols: [],
    interfaceCats: []
  },
  initApi: {
    url: '',
    fetcherProvider: async (ctx) => {
      if (ctx.pathname?.includes('/interface/col')) {
        const interfaceCols = await pb
          .collection('interface_cols')
          .getFullList({
            sort: 'index',
            filter: `projectId='${ctx.projectId}'`
          });
        return {
          interfaceCols: interfaceCols.map((col) => ({
            label: col.name,
            value: col.id,
            desc: col.desc,
            icon: 'FolderOutlined',
            to: `/project/${ctx.projectId}/interface/col/${
              col.name === '公共测试集' ? '' : col.id
            }`
          }))
        };
      }
      const interfaceCats = await pb.collection('interface_cats').getFullList({
        sort: 'index',
        filter: `projectId='${ctx.projectId}'`
      });

      return {
        interfaceCats: [
          {
            label: '全部分类',
            icon: 'FolderOutlined',
            to: `/project/${ctx.projectId}/interface/api`
          },
          ...interfaceCats.map((item) => ({
            label: item.name,
            desc: item.desc,
            icon: 'FolderOutlined',
            id: item.id,
            to: `/project/${ctx.projectId}/interface/api/cat-${item.id}`,
            defer: item.id !== ctx.catId,
            deferApi: {
              fetcherProvider: async () => {
                const result = await pb
                  .collection('interfaces')
                  .getList(0, 50, {
                    filter: `projectId='${ctx.projectId}'&&catId='${item.id}'`
                  });
                console.log(
                  '🚀 ~ fetcherProvider: ~ interfaces:',
                  result,
                  'for catId=',
                  item.id
                );
                return {
                  items: result.items.map((one) => ({
                    label: one.title,
                    id: one.id,
                    icon: 'FileOutlined',
                    desc: one.desc,
                    to: `/project/${ctx.projectId}/interface/api/${one.id}`
                  }))
                };
              }
            }
          }))
        ]
      };
    }
  },
  body: [
    {
      type: 'tabs',
      tabsMode: 'strong',
      className: 'w-72',
      activeKey: '${IF(CONTAINS(pathname, "interface/col"), 1, 0)}',
      tabs: [
        {
          title: '接口列表',
          className: 'overflow-y-auto',
          style: {
            height: 'calc(100vh - 160px)'
          },
          body: {
            type: 'nav',
            searchable: true,
            stacked: true,
            source: '${interfaceCats}',
            id: 'interfaceCatsNav'
          }
        },
        {
          title: '测试集合',
          body: {
            type: 'nav',
            stacked: true,
            source: '${interfaceCols}'
          }
        }
      ],
      onEvent: {
        change: {
          actions: [
            {
              actionType: 'link',
              args: {
                link: '/project/${projectId}/${event.data.value === 0 ? "interface/api" : "interface/col"}'
              }
            }
          ]
        }
      }
    },
    {
      type: 'app-router',
      routerId: 'interfaceApis'
    },
    {
      type: 'app-router',
      routerId: 'interfaceCols'
    },
    { type: 'app-router', routerId: 'singleInterface' }
  ]
};
