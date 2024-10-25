interface BaseResBodyItem {
  title?: string;
  description?: string;
  required?: boolean;
  default?: any;
  other?: string;
}

interface ResBodyObject extends BaseResBodyItem {
  type: 'object';
  properties: Record<string, ResBody>;
}

interface ResBodyArray extends BaseResBodyItem {
  type: 'array';
  items: ResBodyObject;
}

interface ResBodyString extends BaseResBodyItem {
  type: 'string';
  format?: string;
}

interface ResBodyInteger extends BaseResBodyItem {
  type: 'integer';
  format?: string;
}

type ResBody = ResBodyObject | ResBodyArray | ResBodyString | ResBodyInteger;

export interface ResBodyFormattedItem {
  name: string;
  type: 'string' | 'integer' | 'array' | 'object';
  description?: string;
  required?: boolean;
  default?: any;
  other?: string;
  children: ResBodyFormattedItem[];
}

export const parseResBody = (resBodyStr: string) => {
  const resBody = JSON.parse(resBodyStr) as ResBodyObject;

  const parseBodyItem = (
    key: string,
    bodyItem: ResBody
  ): ResBodyFormattedItem => {
    const { type, description, required } = bodyItem;

    const item: ResBodyFormattedItem = {
      name: key,
      type,
      description,
      required,
      default: bodyItem.default,
      children: []
    };
    try {
      if (type === 'string' || type === 'integer') {
        item.other = bodyItem.format ? `format: ${bodyItem.format}` : '';
        return item;
      } else if (type === 'object' && bodyItem.properties) {
        item.children = Object.entries(bodyItem.properties).map(([key, item]) =>
          parseBodyItem(key, item)
        );
        return item;
      } else if (type === 'array') {
        item.children = Object.entries(bodyItem.items.properties).map(
          ([key, item]) => parseBodyItem(key, item)
        );
        return item;
      } else {
        return item;
      }
    } catch (err) {
      console.log(
        '🚀 ~ parseResBody ~ err:',
        err,
        ', key=',
        key,
        ', bodyItem=',
        bodyItem
      );
      return item;
    }
  };
  return resBody.properties == null
    ? resBody.properties
    : Object.entries(resBody.properties).map(([key, item]) =>
        parseBodyItem(key, item)
      );
};
