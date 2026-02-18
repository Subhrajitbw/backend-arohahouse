import * as React from "react"
import { Textarea, Label, clx, Button } from "@medusajs/ui"
import { useController, ControllerRenderProps } from "react-hook-form"

export interface MarkdownFieldProps {
  className?: string
  name: string
  label?: string
  labelProps?: React.ComponentProps<typeof Label>
  textareaProps?: Omit<
    React.ComponentProps<typeof Textarea>,
    "name" | "id" | "type" | keyof ControllerRenderProps
  >
  isRequired?: boolean
}

type WrapMode = "block" | "line"

const TOOLBAR: Array<{
  label: string
  prefix: string
  suffix?: string
  placeholder: string
  mode?: WrapMode
}> = [
  { label: "H2", prefix: "## ", placeholder: "Section heading", mode: "line" },
  { label: "H3", prefix: "### ", placeholder: "Sub heading", mode: "line" },
  { label: "Bold", prefix: "**", suffix: "**", placeholder: "bold text" },
  { label: "Bullet", prefix: "- ", placeholder: "list item", mode: "line" },
  { label: "Quote", prefix: "> ", placeholder: "quoted text", mode: "line" },
]

function applyMarkdown(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  tool: (typeof TOOLBAR)[number]
) {
  const before = currentValue.slice(0, selectionStart)
  const selected = currentValue.slice(selectionStart, selectionEnd)
  const after = currentValue.slice(selectionEnd)
  const content = selected || tool.placeholder

  if (tool.mode === "line") {
    const withLinePrefix = content
      .split("\n")
      .map((line) => `${tool.prefix}${line}`)
      .join("\n")
    const nextValue = `${before}${withLinePrefix}${after}`
    return {
      value: nextValue,
      start: selectionStart,
      end: selectionStart + withLinePrefix.length,
    }
  }

  const wrapped = `${tool.prefix}${content}${tool.suffix ?? ""}`
  const nextValue = `${before}${wrapped}${after}`
  return {
    value: nextValue,
    start: selectionStart,
    end: selectionStart + wrapped.length,
  }
}

export const MarkdownField: React.FC<MarkdownFieldProps> = ({
  className,
  name,
  label,
  labelProps,
  textareaProps,
  isRequired,
}) => {
  const { field, fieldState } = useController<{ __name__: string }, "__name__">(
    { name: name as "__name__" }
  )
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)

  const onFormatClick = (tool: (typeof TOOLBAR)[number]) => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    const start = textarea.selectionStart ?? 0
    const end = textarea.selectionEnd ?? start
    const current = `${field.value ?? ""}`
    const next = applyMarkdown(current, start, end, tool)
    field.onChange(next.value)

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(next.start, next.end)
    })
  }

  return (
    <div className={className}>
      {typeof label !== "undefined" && (
        <Label
          {...labelProps}
          htmlFor={name}
          className={clx("block mb-1", labelProps?.className)}
        >
          {label}
          {isRequired ? <span className="text-red-primary">*</span> : ""}
        </Label>
      )}
      <div className="flex flex-wrap gap-2 mb-2">
        {TOOLBAR.map((item) => (
          <Button
            type="button"
            key={item.label}
            size="small"
            variant="secondary"
            onClick={() => onFormatClick(item)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <Textarea
        {...textareaProps}
        {...field}
        ref={(node) => {
          textareaRef.current = node
          if (typeof field.ref === "function") {
            field.ref(node)
          } else if (field.ref) {
            ;(field.ref as React.MutableRefObject<HTMLTextAreaElement | null>).current =
              node
          }
        }}
        value={field.value ?? ""}
        id={name}
        aria-invalid={Boolean(fieldState.error)}
      />
      {fieldState.error && (
        <div className="text-red-primary text-sm mt-1">
          {fieldState.error.message}
        </div>
      )}
    </div>
  )
}
