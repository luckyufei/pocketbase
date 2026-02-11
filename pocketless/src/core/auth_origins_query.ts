/**
 * AuthOrigins 查询辅助函数
 * 与 Go 版 core/auth_origin_query.go + auth_origin_model.go 对齐
 *
 * _authOrigins 表字段：id, collectionRef, recordRef, fingerprint, created, updated
 */

export class AuthOrigin {
  id = "";
  collectionRef = "";
  recordRef = "";
  fingerprint = "";
  created = "";
  updated = "";
}

/** 查找某个 auth record 的所有 AuthOrigin */
export function findAllAuthOriginsByRecord(
  store: AuthOrigin[],
  collectionRef: string,
  recordRef: string,
): AuthOrigin[] {
  return store.filter(
    (ao) => ao.collectionRef === collectionRef && ao.recordRef === recordRef,
  );
}

/** 查找某个 collection 的所有 AuthOrigin */
export function findAllAuthOriginsByCollection(
  store: AuthOrigin[],
  collectionRef: string,
): AuthOrigin[] {
  return store.filter((ao) => ao.collectionRef === collectionRef);
}

/** 按 ID 查找 AuthOrigin */
export function findAuthOriginById(
  store: AuthOrigin[],
  id: string,
): AuthOrigin | null {
  return store.find((ao) => ao.id === id) ?? null;
}

/** 按 record + fingerprint 查找 AuthOrigin */
export function findAuthOriginByRecordAndFingerprint(
  store: AuthOrigin[],
  collectionRef: string,
  recordRef: string,
  fingerprint: string,
): AuthOrigin | null {
  return (
    store.find(
      (ao) =>
        ao.collectionRef === collectionRef &&
        ao.recordRef === recordRef &&
        ao.fingerprint === fingerprint,
    ) ?? null
  );
}

/** 删除某个 auth record 的所有 AuthOrigin，返回删除的数量 */
export function deleteAllAuthOriginsByRecord(
  store: AuthOrigin[],
  collectionRef: string,
  recordRef: string,
): number {
  let deleted = 0;
  for (let i = store.length - 1; i >= 0; i--) {
    if (
      store[i].collectionRef === collectionRef &&
      store[i].recordRef === recordRef
    ) {
      store.splice(i, 1);
      deleted++;
    }
  }
  return deleted;
}
