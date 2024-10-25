import { pb } from '../libs/pocketbase';
import { PageSchema } from 'jamis';

/**
 * 接口分类列表
 */
export const InterfaceApiPage: PageSchema = {
  type: 'page',
  body: [
    {
      type: 'crud',
      title: '${currentCat.label}有 ${count} 个',
      className: 'w-full',
      api: {
        url: '',
        trackExpression: '${catId}',
        fetcherProvider: async (ctx, api) => {
          console.log(
            '🚀 ~ CrudInterfaceCats fetcherProvider: ~ ctx, api:',
            ctx,
            api
          );
          const { items, totalItems } = await pb
            .collection('interfaces')
            .getList(ctx.page, ctx.perPage, {
              filter: [
                `projectId="${ctx.projectId}"`,
                ctx.catId == null ? '1=1' : `catId='${ctx.catId}'`
              ].join('&&'),
              expand: 'catId'
            });

          // setTimeout(() => {
          //   jarvis.updateDataScope('interfacesPageId', {
          //     interfaceCats: ctx.interfaceCats.map((cat: any) =>
          //       cat.value === ctx.catId
          //         ? {
          //             ...cat,
          //             children: items.map((item) => ({
          //               label: item.name,
          //               desc: item.desc,
          //               icon: 'FileOutlined',
          //               to: `/project/${ctx.projectId}/interface/api/${item.id}`
          //             }))
          //           }
          //         : cat
          //     )
          //   });
          // }, 3500);

          return {
            data: {
              items,
              count: totalItems,
              currentCat: ctx.interfaceCats?.find(
                (item: any) => item.to === ctx.pathname
              )
            }
          };
        }
      },
      prefixRegion: {
        type: 'tpl',
        tpl: '${currentCat.desc}',
        visibleOn: '${currentCat.desc}',
        className:
          'flex mb-3 pl-2 border-0 border-l-4 border-solid border-primary'
      },
      columns: [
        {
          type: 'button',
          name: 'title',
          label: '${title || "接口名称"}',
          level: 'link',
          actionType: 'link',
          link: '/project/${projectId}/interface/api/${id}'
        },
        {
          label: '接口路径',
          type: 'flex',
          body: [
            {
              type: 'tag',
              tag: 'GET'
            },
            '${path}'
          ]
        },
        {
          label: '接口分类',
          name: 'expand.catId.name'
        },
        {
          type: 'mapping',
          name: 'status',
          label: '状态',
          map: {
            done: '已完成',
            undone: '未完成'
          }
        },
        {
          type: 'tag',
          label: '标签',
          name: 'tag',
          tag: '${tag}'
        }
      ]
    }
  ]
};
