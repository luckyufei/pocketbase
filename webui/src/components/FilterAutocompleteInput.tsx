/**
 * Filter Autocomplete Input
 * 支持 PocketBase filter 语法的自动补全输入框
 * 
 * Task 7: 使用 CodeMirror 实现语法高亮和自动补全
 * 对标 ui/src/components/base/FilterAutocompleteInput.svelte
 * 对标 ui/src/components/base/Searchbar.svelte 的样式
 */
import { useCallback, useMemo, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { CollectionModel } from 'pocketbase'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { 
  EditorView, 
  keymap, 
  placeholder as placeholderExt,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  highlightActiveLineGutter,
} from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { 
  autocompletion, 
  CompletionContext, 
  type Completion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { filterLanguage } from './filterLanguage'
import {
  getAllAutocompleteKeys,
  FILTER_MACROS,
} from '@/lib/filterAutocomplete'

// 默认占位符文本（与 Svelte 版本一致）
const DEFAULT_PLACEHOLDER = 'Search term or filter like created > "2022-01-01"...'

interface FilterAutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: (value: string) => void
  collections?: CollectionModel[]
  baseCollection?: CollectionModel | null
  placeholder?: string
  disabled?: boolean
  className?: string
  singleLine?: boolean
}

export function FilterAutocompleteInput({
  value,
  onChange,
  onSubmit,
  collections = [],
  baseCollection,
  placeholder = DEFAULT_PLACEHOLDER,
  disabled = false,
  className,
  singleLine = true, // 默认单行模式（搜索框场景）
}: FilterAutocompleteInputProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  // 保存提交回调的 ref，避免 extensions 依赖变化
  const onSubmitRef = useRef(onSubmit)
  onSubmitRef.current = onSubmit
  
  // Task 1: 已提交的值状态，用于控制搜索按钮显示
  const [submittedValue, setSubmittedValue] = useState('')

  // Task 1: 计算是否显示搜索按钮
  // 仅当 value 非空且与已提交值不同时显示
  const showSearchButton = value.trim() !== '' && value !== submittedValue

  // Task 3: 计算是否显示清空按钮
  const showClearButton = value.trim() !== ''

  // 计算自动补全键
  const autocompleteKeys = useMemo(() => {
    return getAllAutocompleteKeys(collections, baseCollection)
  }, [collections, baseCollection])

  // Task 1: 处理搜索提交
  const handleSubmit = useCallback((submitValue: string) => {
    setSubmittedValue(submitValue)
    onSubmit?.(submitValue)
  }, [onSubmit])

  // Task 3: 处理清空
  const handleClear = useCallback(() => {
    onChange('')
    handleSubmit('')
    editorRef.current?.view?.focus()
  }, [onChange, handleSubmit])

  // CodeMirror 值变化处理
  const handleChange = useCallback((val: string) => {
    onChange(val)
  }, [onChange])

  // 自动补全函数
  const completions = useCallback((context: CompletionContext) => {
    const word = context.matchBefore(/[\'\"\@\w\.\:]*/);
    if (word && word.from === word.to && !context.explicit) {
      return null;
    }

    const options: Completion[] = [];

    // 添加宏（已包含 true/false/null）
    for (const macro of FILTER_MACROS) {
      options.push({
        label: macro.label,
        type: macro.type,  // 使用原始类型，不强制覆盖
        info: macro.info,
      });
    }

    // 添加基础字段
    for (const key of autocompleteKeys.baseKeys) {
      options.push({
        label: key,
        type: 'property',
      });
    }

    // @request 键
    if (word?.text.startsWith('@r')) {
      for (const key of autocompleteKeys.requestKeys) {
        options.push({
          label: key,
          type: 'property',
        });
      }
    }

    // @collection 键
    if (word?.text.startsWith('@c')) {
      options.push({
        label: '@collection.*',
        apply: '@collection.',
        type: 'keyword',
        info: '跨集合查询',
      });
      for (const key of autocompleteKeys.collectionJoinKeys) {
        options.push({
          label: key,
          type: 'property',
          boost: key.indexOf('_via_') > 0 ? -1 : 0, // 降低 _via_ 键的优先级
        });
      }
    }

    return {
      from: word?.from ?? context.pos,
      options,
    };
  }, [autocompleteKeys]);

  // CodeMirror 扩展配置
  // 对标 ui 版本: editor = new EditorView({ state: EditorState.create({ extensions: [...] }) })
  const extensions = useMemo(() => {
    // Enter 键处理：单行模式下触发提交
    // 对标 ui 版本: const submitShortcut = { key: "Enter", run: ... }
    const submitShortcut = {
      key: 'Enter',
      run: (view: EditorView) => {
        if (singleLine) {
          const text = view.state.doc.toString();
          if (onSubmitRef.current) {
            setSubmittedValue(text);
            onSubmitRef.current(text);
          }
          return true; // 阻止默认换行行为
        }
        return false;
      },
    };

    // 构建 keybindings
    // 对标 ui 版本: let keybindings = [submitShortcut, ...closeBracketsKeymap, ...defaultKeymap, ...]
    const keybindings = [
      submitShortcut,
      ...closeBracketsKeymap,
      ...defaultKeymap,
      searchKeymap.find((item) => item.key === 'Mod-d'),
      ...historyKeymap,
      ...completionKeymap,
    ].filter(Boolean) as typeof defaultKeymap;

    // 单行模式的 transaction filter
    // 对标 ui 版本: EditorState.transactionFilter.of((tr) => { if (singleLine && tr.newDoc.lines > 1) ... })
    const singleLineFilter = EditorState.transactionFilter.of((tr) => {
      if (singleLine && tr.newDoc.lines > 1) {
        // 获取所有行的文本
        const texts: string[] = [];
        tr.newDoc.iterLines((line) => {
          texts.push(line);
        });
        
        // 检查是否只有空行
        const hasContent = texts.some(t => t.trim() !== '');
        if (!hasContent) {
          return []; // 只有空行，拒绝此事务
        }
        
        // 合并为单行（与 ui 版本行为一致）
        // ui 版本: tr.newDoc.text = [tr.newDoc.text.join(" ")];
        const mergedText = texts.join(' ').trim();
        return {
          ...tr,
          changes: {
            from: 0,
            to: tr.startState.doc.length,
            insert: mergedText,
          },
        };
      }
      return tr;
    });

    return [
      // 基础视图扩展（对标 ui 版本）
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      rectangularSelection(),
      highlightSelectionMatches(),
      // 键盘映射（注意顺序：submitShortcut 在最前面）
      keymap.of(keybindings),
      EditorView.lineWrapping,
      // 自动补全
      autocompletion({
        override: [completions],
        icons: false,
      }),
      // 占位符
      placeholderExt(placeholder),
      // 可编辑/只读状态
      EditorView.editable.of(!disabled),
      EditorState.readOnly.of(disabled),
      // 语法高亮
      filterLanguage,
      // 单行过滤器
      singleLineFilter,
    ];
  }, [completions, placeholder, disabled, singleLine]);

  return (
    // 外层容器 - 类似 ui 版本的 .searchbar
    // 样式：圆角、边框、背景色，聚焦时有 ring
    <div 
      className={cn(
        'searchbar-container',
        'flex items-center',
        'h-9 px-1',
        'rounded-full',
        'border border-input bg-muted/50',
        'transition-colors',
        'focus-within:bg-muted focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {/* CodeMirror 编辑器 - 无边框，flex-1 占满剩余空间 */}
      <CodeMirror
        ref={editorRef}
        value={value}
        onChange={handleChange}
        extensions={extensions}
        basicSetup={false}
        className="filter-editor-inner flex-1 min-w-0"
        editable={!disabled}
      />

      {/* 按钮区域 - 与 ui 版本对齐 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Task 1 & 2: 搜索按钮 - 黄色/警告色 */}
        {showSearchButton && (
          <button
            type="button"
            onClick={() => handleSubmit(value)}
            aria-label="Search"
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-full',
              'bg-yellow-500 text-white hover:bg-yellow-600',
              'transition-colors'
            )}
          >
            Search
          </button>
        )}

        {/* Task 3: 清空按钮 */}
        {showClearButton && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear"
            className={cn(
              'px-2 py-1 text-xs font-medium rounded-full',
              'text-muted-foreground hover:text-foreground hover:bg-muted',
              'transition-colors'
            )}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

export default FilterAutocompleteInput
