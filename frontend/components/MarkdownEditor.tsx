'use client';

import React, { FC } from 'react';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  tablePlugin,
  linkPlugin,
  linkDialogPlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  InsertCodeBlock,
  type MDXEditorMethods,
  type MDXEditorProps,
} from '@mdxeditor/editor';

interface MarkdownEditorProps {
  markdown: string;
  onChange: (markdown: string) => void;
}

const MarkdownEditor: FC<MarkdownEditorProps> = ({ markdown, onChange }) => {
  return (
    <div className="mdx-editor-wrapper">
      <MDXEditor
        markdown={markdown}
        onChange={onChange}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          markdownShortcutPlugin(),
          tablePlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          codeBlockPlugin({ defaultCodeBlockLanguage: 'js' }),
          codeMirrorPlugin({
            codeBlockLanguages: {
              js: 'JavaScript',
              css: 'CSS',
              txt: 'Text',
              tsx: 'TypeScript',
              python: 'Python',
              bash: 'Bash',
              json: 'JSON',
              html: 'HTML',
            },
          }),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <BoldItalicUnderlineToggles />
                <BlockTypeSelect />
                <ListsToggle />
                <CreateLink />
                <InsertTable />
                <InsertThematicBreak />
                <InsertCodeBlock />
              </>
            ),
          }),
        ]}
        contentEditableClassName="prose prose-sm max-w-none dark:prose-invert text-black dark:text-white"
      />
    </div>
  );
};

export default MarkdownEditor;

