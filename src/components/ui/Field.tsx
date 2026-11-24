import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { describedBy, errorId, hintId, inputClasses } from "./styles";

/** Label above, hint or error below — see styles.ts for the conventions. */
export function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[0.95rem] font-medium text-ink">
        {label}
        {required ? (
          <span className="ml-0.5 text-crimson" aria-hidden>
            *
          </span>
        ) : (
          <span className="ml-1.5 font-normal text-ink-muted">(optional)</span>
        )}
      </label>
      {children}
      {hint && !error ? (
        <p id={hintId(id)} className="mt-1.5 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId(id)} className="mt-1.5 text-sm font-medium text-crimson">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<ComponentProps<"input">, "id"> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  wrapperClassName?: string;
};

export function TextField({ id, label, hint, error, required, wrapperClassName, className, ...input }: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={wrapperClassName}>
      <input
        id={id}
        name={id}
        required={required}
        className={cn(inputClasses(!!error), className)}
        {...describedBy(id, { hint, error })}
        {...input}
      />
    </FieldShell>
  );
}

type SelectFieldProps = Omit<ComponentProps<"select">, "id"> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  wrapperClassName?: string;
};

export function SelectField({ id, label, hint, error, required, wrapperClassName, className, children, ...select }: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={wrapperClassName}>
      <select
        id={id}
        name={id}
        required={required}
        className={cn(inputClasses(!!error), "appearance-none bg-[length:1.1rem] bg-[right_0.9rem_center] bg-no-repeat pr-10", className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235e6283' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...describedBy(id, { hint, error })}
        {...select}
      >
        {children}
      </select>
    </FieldShell>
  );
}
