/**
 * Record Expand — 关联字段展开
 * 与 Go 版 core/record_expand.go 对齐
 * 解析 relation 字段，嵌套 expand 支持
 */

import type { BaseApp } from "./base";
import { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

/**
 * 展开记录的关联字段
 * @param app BaseApp 实例
 * @param records 需要展开的记录列表
 * @param expandStr 展开路径（逗号分隔，点号表示嵌套，如 "author,comments.author"）
 * @param maxDepth 最大嵌套深度（默认 6）
 */
export async function expandRecords(
  app: BaseApp,
  records: RecordModel[],
  expandStr: string,
  maxDepth: number = 6,
): Promise<void> {
  if (!expandStr || records.length === 0 || maxDepth <= 0) return;

  const paths = expandStr.split(",").map((p) => p.trim()).filter(Boolean);

  for (const path of paths) {
    const parts = path.split(".");
    const fieldName = parts[0];
    const nestedExpand = parts.slice(1).join(".");

    await expandField(app, records, fieldName, nestedExpand, maxDepth - 1);
  }
}

/**
 * 展开单个字段
 */
async function expandField(
  app: BaseApp,
  records: RecordModel[],
  fieldName: string,
  nestedExpand: string,
  remainingDepth: number,
): Promise<void> {
  if (records.length === 0) return;

  const collection = records[0].collection();
  const field = collection.getFieldByName(fieldName);
  if (!field || field.type !== "relation") return;

  const relatedCollectionId = field.options?.collectionId as string;
  if (!relatedCollectionId) return;

  const relatedCol = await app.findCollectionByNameOrId(relatedCollectionId);
  if (!relatedCol) return;

  // 收集所有需要展开的 ID
  const allIds = new Set<string>();
  for (const record of records) {
    const val = record.get(fieldName);
    if (typeof val === "string" && val) {
      allIds.add(val);
    } else if (Array.isArray(val)) {
      for (const id of val) {
        if (typeof id === "string" && id) allIds.add(id);
      }
    }
  }

  if (allIds.size === 0) return;

  // 批量查询关联记录
  const idsArr = [...allIds];
  const placeholders = idsArr.map(() => "?").join(", ");
  const rows = app.dbAdapter().query(
    `SELECT * FROM ${relatedCol.name} WHERE id IN (${placeholders})`,
    ...idsArr,
  );

  const relatedMap = new Map<string, RecordModel>();
  for (const row of rows) {
    const r = new RecordModel(relatedCol);
    r.load(row as Record<string, unknown>);
    relatedMap.set(r.id, r);
  }

  // 递归展开嵌套
  if (nestedExpand && remainingDepth > 0) {
    await expandRecords(app, [...relatedMap.values()], nestedExpand, remainingDepth);
  }

  // 挂载 expand 数据
  const isMulti = field.options?.maxSelect && (field.options.maxSelect as number) > 1;
  for (const record of records) {
    const val = record.get(fieldName);
    if (typeof val === "string" && val) {
      const related = relatedMap.get(val);
      if (related) record.setExpand(fieldName, related.toJSON());
    } else if (Array.isArray(val)) {
      const expanded = val
        .map((id: string) => relatedMap.get(id))
        .filter(Boolean)
        .map((r) => r!.toJSON());
      if (expanded.length > 0) record.setExpand(fieldName, expanded);
    }
  }
}
