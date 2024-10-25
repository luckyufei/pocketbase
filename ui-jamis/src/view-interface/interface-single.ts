import { PageSchema } from 'jamis';
import { InterfacePreviewView } from './interface-preview';

export const SingleInterfacePage: PageSchema = {
  type: 'page',
  body: [
    {
      type: 'tabs',
      tabsMode: 'chrome',
      tabs: [
        {
          title: '预览',
          body: InterfacePreviewView
        },
        {
          title: '编辑',
          body: []
        },
        {
          title: '运行',
          body: []
        },
        {
          title: '高级Mock',
          body: []
        }
      ]
    }
  ]
};
