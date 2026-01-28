import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Minus,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  editor: Editor | null;
}

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) {
    return null;
  }

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-1 p-2">
        {/* Heading Dropdown */}
        <DropdownMenu
          trigger={
            <Button variant="ghost" size="sm" className="h-9">
              <span className="text-sm">
                {editor.isActive('heading', { level: 1 }) ? 'H1' :
                 editor.isActive('heading', { level: 2 }) ? 'H2' :
                 editor.isActive('heading', { level: 3 }) ? 'H3' :
                 editor.isActive('heading', { level: 4 }) ? 'H4' :
                 editor.isActive('heading', { level: 5 }) ? 'H5' :
                 editor.isActive('heading', { level: 6 }) ? 'H6' :
                 'Normal'}
              </span>
              <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          }
        >
          <DropdownMenuItem
            onClick={() => editor.chain().focus().setParagraph().run()}
          >
            Normal
          </DropdownMenuItem>
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <DropdownMenuItem
              key={level}
              onClick={() => editor.chain().focus().toggleHeading({ level: level as any }).run()}
            >
              Heading {level}
            </DropdownMenuItem>
          ))}
        </DropdownMenu>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Text Formatting */}
        <Tooltip content="Bold">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(editor.isActive('bold') && 'bg-accent')}
          >
            <Bold className="w-4 h-4" />
          </Button>
        </Tooltip>

        <Tooltip content="Italic">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(editor.isActive('italic') && 'bg-accent')}
          >
            <Italic className="w-4 h-4" />
          </Button>
        </Tooltip>

        <Tooltip content="Strikethrough">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={cn(editor.isActive('strike') && 'bg-accent')}
          >
            <Strikethrough className="w-4 h-4" />
          </Button>
        </Tooltip>

        <Tooltip content="Inline Code">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={cn(editor.isActive('code') && 'bg-accent')}
          >
            <Code className="w-4 h-4" />
          </Button>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Lists */}
        <Tooltip content="Bullet List">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(editor.isActive('bulletList') && 'bg-accent')}
          >
            <List className="w-4 h-4" />
          </Button>
        </Tooltip>

        <Tooltip content="Ordered List">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(editor.isActive('orderedList') && 'bg-accent')}
          >
            <ListOrdered className="w-4 h-4" />
          </Button>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Block Elements */}
        <Tooltip content="Blockquote">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn(editor.isActive('blockquote') && 'bg-accent')}
          >
            <Quote className="w-4 h-4" />
          </Button>
        </Tooltip>

        <Tooltip content="Code Block">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={cn(editor.isActive('codeBlock') && 'bg-accent')}
          >
            <Code className="w-4 h-4" />
          </Button>
        </Tooltip>

        <Tooltip content="Horizontal Rule">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus className="w-4 h-4" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
