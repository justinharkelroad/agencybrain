import { useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { isHtmlContent } from './ChatBubble';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Palette,
  Undo,
  Redo,
  Send,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface RichTextEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue: string;
  onSubmit: (html: string) => void;
  placeholder?: string;
}

const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#a855f7' },
];

const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Green', value: '#bbf7d0' },
  { label: 'Blue', value: '#bfdbfe' },
  { label: 'Pink', value: '#fbcfe8' },
  { label: 'Orange', value: '#fed7aa' },
];

export function RichTextEditorDialog({
  open,
  onOpenChange,
  initialValue,
  onSubmit,
  placeholder = 'Start writing your response...',
}: RichTextEditorDialogProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  // Convert plain text to paragraph HTML; pass existing HTML through directly
  const toEditorContent = (value: string): string => {
    if (!value) return '';
    if (isHtmlContent(value)) return value;
    // Escape HTML entities in plain text so Tiptap doesn't misparse <, >, &
    // Split on newlines so each line becomes its own <p> (preserves line breaks)
    return value
      .split('\n')
      .map((line) => {
        const escaped = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return `<p>${escaped}</p>`;
      })
      .join('');
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline' },
      }),
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: toEditorContent(initialValue),
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-3',
      },
    },
  });

  // Reset editor content each time the dialog opens so it reflects the latest textarea value
  useEffect(() => {
    if (open && editor) {
      editor.commands.setContent(toEditorContent(initialValue));
      // Move cursor to end
      editor.commands.focus('end');
      // Close any open pickers
      setShowColorPicker(false);
      setShowHighlightPicker(false);
    }
  }, [open, editor]); // intentionally omit initialValue — we only want this on open transitions

  const handleSubmit = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    // Don't submit empty content
    if (html === '<p></p>' || !html.trim()) return;
    onSubmit(html);
    onOpenChange(false);
  }, [editor, onSubmit, onOpenChange]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none w-full h-full sm:max-w-none sm:rounded-none p-0 flex flex-col"
        hideCloseButton
      >
        <VisuallyHidden>
          <DialogTitle>Rich Text Editor</DialogTitle>
        </VisuallyHidden>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30 shrink-0">
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            icon={<Bold className="h-4 w-4" />}
          />
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            icon={<Italic className="h-4 w-4" />}
          />
          <ToolbarButton
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            icon={<UnderlineIcon className="h-4 w-4" />}
          />
          <ToolbarButton
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            icon={<Strikethrough className="h-4 w-4" />}
          />

          <Separator />

          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            icon={<Heading2 className="h-4 w-4" />}
          />
          <ToolbarButton
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            icon={<Heading3 className="h-4 w-4" />}
          />

          <Separator />

          <ToolbarButton
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            icon={<List className="h-4 w-4" />}
          />
          <ToolbarButton
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            icon={<ListOrdered className="h-4 w-4" />}
          />

          <Separator />

          <ToolbarButton
            active={editor.isActive({ textAlign: 'left' })}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            icon={<AlignLeft className="h-4 w-4" />}
          />
          <ToolbarButton
            active={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            icon={<AlignCenter className="h-4 w-4" />}
          />
          <ToolbarButton
            active={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            icon={<AlignRight className="h-4 w-4" />}
          />

          <Separator />

          {/* Text Color */}
          <div className="relative">
            <ToolbarButton
              active={showColorPicker}
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowHighlightPicker(false);
              }}
              icon={<Palette className="h-4 w-4" />}
            />
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-1 bg-background border rounded-lg shadow-lg p-2 flex gap-1 z-50">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color.label}
                    className={cn(
                      'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                      color.value ? '' : 'bg-foreground',
                      editor.isActive('textStyle', { color: color.value }) ? 'border-primary' : 'border-transparent'
                    )}
                    style={color.value ? { backgroundColor: color.value } : undefined}
                    onClick={() => {
                      if (color.value) {
                        editor.chain().focus().setColor(color.value).run();
                      } else {
                        editor.chain().focus().unsetColor().run();
                      }
                      setShowColorPicker(false);
                    }}
                    title={color.label}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Highlight */}
          <div className="relative">
            <ToolbarButton
              active={showHighlightPicker || editor.isActive('highlight')}
              onClick={() => {
                setShowHighlightPicker(!showHighlightPicker);
                setShowColorPicker(false);
              }}
              icon={<Highlighter className="h-4 w-4" />}
            />
            {showHighlightPicker && (
              <div className="absolute top-full left-0 mt-1 bg-background border rounded-lg shadow-lg p-2 flex gap-1 z-50">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color.label}
                    className={cn(
                      'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                      editor.isActive('highlight', { color: color.value }) ? 'border-primary' : 'border-transparent'
                    )}
                    style={{ backgroundColor: color.value }}
                    onClick={() => {
                      editor.chain().focus().toggleHighlight({ color: color.value }).run();
                      setShowHighlightPicker(false);
                    }}
                    title={color.label}
                  />
                ))}
                <button
                  className="w-6 h-6 rounded-full border-2 border-transparent bg-muted flex items-center justify-center text-xs hover:scale-110 transition-transform"
                  onClick={() => {
                    editor.chain().focus().unsetHighlight().run();
                    setShowHighlightPicker(false);
                  }}
                  title="Remove highlight"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          <ToolbarButton
            active={editor.isActive('link')}
            onClick={addLink}
            icon={<LinkIcon className="h-4 w-4" />}
          />

          <div className="flex-1" />

          <ToolbarButton
            active={false}
            onClick={() => editor.chain().focus().undo().run()}
            icon={<Undo className="h-4 w-4" />}
            disabled={!editor.can().undo()}
          />
          <ToolbarButton
            active={false}
            onClick={() => editor.chain().focus().redo().run()}
            icon={<Redo className="h-4 w-4" />}
            disabled={!editor.can().redo()}
          />
        </div>

        {/* Editor Area */}
        <div
          className="flex-1 overflow-y-auto"
          onClick={() => {
            setShowColorPicker(false);
            setShowHighlightPicker(false);
          }}
        >
          <EditorContent editor={editor} className="h-full" />
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between p-3 border-t bg-muted/30 shrink-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            CLOSE
          </Button>
          <Button
            onClick={handleSubmit}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            SEND
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToolbarButton({
  active,
  onClick,
  icon,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="h-8 w-8 p-0"
    >
      {icon}
    </Button>
  );
}

function Separator() {
  return <div className="w-px h-6 bg-border mx-1 self-center" />;
}
