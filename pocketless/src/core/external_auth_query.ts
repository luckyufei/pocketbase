/**
 * ExternalAuth 查询辅助函数
 * 与 Go 版 core/external_auth_query.go + external_auth_model.go 对齐
 *
 * _externalAuths 表字段：id, collectionRef, recordRef, provider, providerId, created, updated
 */

export class ExternalAuth {
  id = "";
  collectionRef = "";
  recordRef = "";
  provider = "";
  providerId = "";
  created = "";
  updated = "";
}

/** 查找某个 auth record 的所有 ExternalAuth */
export function findAllExternalAuthsByRecord(
  store: ExternalAuth[],
  collectionRef: string,
  recordRef: string,
): ExternalAuth[] {
  return store.filter(
    (ea) => ea.collectionRef === collectionRef && ea.recordRef === recordRef,
  );
}

/** 查找某个 collection 的所有 ExternalAuth */
export function findAllExternalAuthsByCollection(
  store: ExternalAuth[],
  collectionRef: string,
): ExternalAuth[] {
  return store.filter((ea) => ea.collectionRef === collectionRef);
}

/** 按条件查找第一个匹配的 ExternalAuth */
export function findFirstExternalAuthByExpr(
  store: ExternalAuth[],
  expr: Partial<ExternalAuth>,
): ExternalAuth | null {
  return (
    store.find((ea) =>
      Object.entries(expr).every(
        ([key, value]) => ea[key as keyof ExternalAuth] === value,
      ),
    ) ?? null
  );
}
