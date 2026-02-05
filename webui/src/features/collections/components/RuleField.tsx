// T024: 单个规则编辑器组件
// 与 UI 版本保持一致的样式：白色背景、标签在上方、按钮在右上角
import { useState, useMemo, useRef } from 'react'
import { Lock, Unlock } from 'lucide-react'
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
import { filterLanguage } from '@/components/filterLanguage'
import {
  getAllAutocompleteKeys,
  FILTER_MACROS,
} from '@/lib/filterAutocomplete'

interface RuleFieldProps {
  label: string
  formKey: string
  rule: string | null | undefined
  onChange: (rule: string | null) => void
  collection: {
    name: string
    type: string
    system?: boolean
    fields?: Array<{ name: string; type: string; hidden?: boolean }>
  }
  placeholder?: string
  required?: boolean
  disabled?: boolean
  superuserToggle?: boolean
  helpText?: React.ReactNode
  afterLabel?: React.ReactNode
}

/**
 * 规则编辑器组件
 * 与 UI 版本保持一致的样式：
 * - 白色背景输入框
 * - 标签在输入框上方
 * - "Set Superusers only" 按钮在右上角
 * - 锁定时显示解锁覆盖层
 */
export function RuleField({
  label,
  formKey,
  rule,
  onChange,
  collection,
  placeholder = '',
  required = false,
  disabled = false,
  superuserToggle = true,
  helpText,
  afterLabel,
}: RuleFieldProps) {
  const [tempValue, setTempValue] = useState<string>('')
  const editorRef = useRef<ReactCodeMirrorRef>(null)

  const isSuperuserOnly = superuserToggle && rule === null
  const isDisabled = disabled || collection.system

  // 解锁规则
  const unlock = () => {
    onChange(tempValue || '')
    // 延迟聚焦，等待组件更新
    setTimeout(() => {
      editorRef.current?.view?.focus()
    }, 50)
  }

  // 锁定规则（设为 Superusers only）
  const lock = () => {
    setTempValue(rule || '')
    onChange(null)
  }

  // 计算自动补全键
  const autocompleteKeys = useMemo(() => {
    return getAllAutocompleteKeys([], collection as CollectionModel)
  }, [collection])

  // 自动补全函数
  const completions = (context: CompletionContext) => {
    const word = context.matchBefore(/[\'\"\@\w\.\:]*/);
    if (word && word.from === word.to && !context.explicit) {
      return null;
    }

    const options: Completion[] = [];

    // 添加宏
    for (const macro of FILTER_MACROS) {
      options.push({
        label: macro.label,
        type: macro.type,
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
          boost: key.indexOf('_via_') > 0 ? -1 : 0,
        });
      }
    }

    return {
      from: word?.from ?? context.pos,
      options,
    };
  }

  // CodeMirror 扩展配置
  const extensions = useMemo(() => {
    const keybindings = [
      ...closeBracketsKeymap,
      ...defaultKeymap,
      searchKeymap.find((item) => item.key === 'Mod-d'),
      ...historyKeymap,
      ...completionKeymap,
    ].filter(Boolean)

    return [
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
      keymap.of(keybindings as any),
      EditorView.lineWrapping,
      autocompletion({
        override: [completions],
        icons: false,
      }),
      placeholderExt(placeholder),
      EditorView.editable.of(!isDisabled && !isSuperuserOnly),
      EditorState.readOnly.of(isDisabled || isSuperuserOnly),
      filterLanguage,
    ];
  }, [placeholder, isDisabled, isSuperuserOnly, completions]);

  return (
    <div className="rule-field">
      {/* 输入框容器 - 聚焦时整体背景变化 */}
      <div className={cn(
        "relative rounded-lg transition-colors",
        "bg-slate-100 focus-within:bg-slate-200/70"
      )}>
        {/* 标签行：标签在上方，按钮在右上角绝对定位 */}
        <label className={cn(
          "flex items-center gap-1.5 text-[13px] font-medium px-3.5 pt-2.5 pb-1",
          isSuperuserOnly && "text-muted-foreground"
        )}>
          <span>{label}</span>
          {isSuperuserOnly && <span className="text-muted-foreground">- Superusers only</span>}
          {afterLabel}
        </label>

        {/* 右上角的"Set Superusers only"按钮 */}
        {superuserToggle && !isSuperuserOnly && !isDisabled && (
          <button
            type="button"
            className={cn(
              "absolute right-0 top-0 px-2 py-2 text-[11px]",
              "text-muted-foreground hover:text-foreground",
              "bg-slate-200/60 hover:bg-slate-200",
              "rounded-tr-lg rounded-bl-lg",
              "flex items-center gap-1 transition-colors"
            )}
            onClick={lock}
          >
            <Lock className="h-3 w-3" />
            <span>Set Superusers only</span>
          </button>
        )}

        {/* 输入区域 */}
        <div className="relative">
          <CodeMirror
            ref={editorRef}
            value={rule || ''}
            onChange={(value) => onChange(value)}
            extensions={extensions}
            basicSetup={false}
            className="rule-editor-inner"
            editable={!isDisabled && !isSuperuserOnly}
          />

          {/* 锁定覆盖层：点击解锁 - 与 UI 版本一致，hover 时文字和图标变绿色 */}
          {superuserToggle && isSuperuserOnly && !isDisabled && (
            <button
              type="button"
              className={cn(
                "absolute inset-0 flex items-center justify-end gap-2 px-4",
                "bg-transparent transition-colors",
                "cursor-pointer group"
              )}
              onClick={unlock}
            >
              <span className="text-xs text-transparent group-hover:text-green-600 transition-colors">
                Unlock and set custom rule
              </span>
              <Unlock className="h-4 w-4 text-green-600" />
            </button>
          )}
        </div>
      </div>

      {helpText && <div className="text-[11px] text-muted-foreground mt-1.5 px-1">{helpText}</div>}

      {/* 内联样式 - 规则输入框专用 */}
      <style>{`
        .rule-field .rule-editor-inner {
          min-height: 36px;
        }
        .rule-field .rule-editor-inner .cm-editor {
          background: transparent !important;
          border: none !important;
          outline: none !important;
        }
        .rule-field .rule-editor-inner .cm-scroller {
          padding: 6px 14px;
          font-family: inherit;
          font-size: 13px;
        }
        .rule-field .rule-editor-inner .cm-content {
          padding: 0;
        }
        .rule-field .rule-editor-inner .cm-line {
          padding: 0;
        }
        .rule-field .rule-editor-inner .cm-placeholder {
          color: var(--muted-foreground);
          font-family: inherit;
          font-size: 13px;
        }
      `}</style>
    </div>
  )
}

export default RuleField
