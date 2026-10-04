import { useRef } from 'react';

import { X } from '@/shared/icons/index.ts';

/** A file picked for filing once the record is saved: the file, and an id for its chip. */
export interface PickedFile {
  id: string;
  file: File;
}

/** Props of {@link DrawerFilesField}. */
export interface DrawerFilesFieldProps {
  /** The zone's id, for the field's `<label htmlFor>`. */
  id: string;
  files: readonly PickedFile[];
  onChange: (files: PickedFile[]) => void;
  /** The file input's `accept`: `image/*`, or `image/*,application/pdf` for a bill. */
  accept: string;
  /** Whether a picked or dropped file is taken — a drop ignores `accept`. */
  takes: (file: File) => boolean;
  /** The zone's first line: "Take or drop photos", "Drop the bill photo or browse". */
  title: string;
  /** Its second line: "JPG or PNG · up to 10 MB each", "Optional · JPG, PNG or PDF". */
  hint: string;
  /** A chip's × name: "Remove bill-1.jpg". */
  removeLabel: (name: string) => string;
  disabled?: boolean;
  /** The zone's test id; the input is `<testId>-input`. */
  testId: string;
}

/**
 * A drawer's upload field (`_patterns.md:34`; the patient's first photos,
 * Send payment's bill): a 96px dashed zone that takes files by click (a phone
 * offers its camera) or drop, then the picks as 24px chips, each removable.
 * Nothing uploads here — the drawer files the picks after its save, through
 * the upload tray, which skips a file over the limit with its own toast.
 */
export function DrawerFilesField({
  id,
  files,
  onChange,
  accept,
  takes,
  title,
  hint,
  removeLabel,
  disabled,
  testId,
}: DrawerFilesFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (list: FileList | null) => {
    const taken = Array.from(list ?? []).filter(takes);
    if (taken.length > 0) {
      onChange([...files, ...taken.map((file) => ({ id: crypto.randomUUID(), file }))]);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        id={id}
        type="button"
        disabled={disabled}
        data-testid={testId}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!disabled) add(event.dataTransfer.files);
        }}
        className="border-border-strong bg-canvas text-body text-muted-foreground-strong hover:border-muted-foreground hover:bg-muted flex h-24 flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        <span className="font-medium">{title}</span>
        <span className="text-caption text-muted-foreground">{hint}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        hidden
        tabIndex={-1}
        data-testid={`${testId}-input`}
        onChange={(event) => {
          add(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {files.map(({ id: fileId, file }) => (
            <li
              key={fileId}
              data-slot="pill"
              className="bg-muted text-muted-foreground-strong inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-full ps-2.5 pe-1 text-xs font-medium tabular-nums"
            >
              <span className="min-w-0 truncate">{file.name}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={removeLabel(file.name)}
                onClick={() => onChange(files.filter((picked) => picked.id !== fileId))}
                data-slot="pill"
                className="hover:bg-muted-strong flex size-4.5 shrink-0 items-center justify-center rounded-full"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
