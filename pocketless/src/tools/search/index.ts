/**
 * Search 模块 barrel export
 */

export { Scanner, type Token, type TokenType, type SignOp, type JoinOp, JoinAnd, JoinOr } from "./scanner";
export { parse, isExpr, ParseError, type Expr, type ExprGroup } from "./parser";
export {
  buildFilterExpr,
  SimpleFieldResolver,
  parseSortFromString,
  buildSortExpr,
  resetParamCounter,
  type FieldResolver,
  type ResolverResult,
  type SortField,
  type FilterBuildOptions,
} from "./filter_resolver";
export { resolveMacro, knownMacros, type MacroValue } from "./macros";
export { extractModifiers, knownModifiers, type Modifier } from "./modifiers";
export { registerTokenFunction, getTokenFunction, type TokenFunction } from "./functions";
export {
  execSearch,
  type SearchResult,
  type SearchProviderOptions,
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
} from "./provider";
