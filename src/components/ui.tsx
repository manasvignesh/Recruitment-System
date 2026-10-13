"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowUpRight, Loader2, Plus, Check } from "lucide-react";
import {
  useId,
  isValidElement,
  cloneElement,
  type ReactNode,
  type ButtonHTMLAttributes,
  type ReactElement,
} from "react";
import { brand } from "@/lib/brand";
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className="logo">
      <span className="logo-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {!small && (
        <span>
          {brand.name}
          <span className="logo-dot">.</span>
        </span>
      )}
    </span>
  );
}
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const generatedId = useId();
  const element = isValidElement(children)
    ? (children as ReactElement<{ id?: string; "aria-describedby"?: string }>)
    : null;
  const id = element?.props.id || generatedId;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {element
        ? cloneElement(element, {
            id,
            "aria-describedby": hint
              ? id + "-hint"
              : element.props["aria-describedby"],
          })
        : children}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
export function Avatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  return (
    <span className={`avatar ${large ? "large" : ""}`} aria-hidden="true">
      {name
        .split(" ")
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}
export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-symbol">
        <Plus size={22} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <Loader2 size={22} className="spin" />
      <span>Opening your workspace…</span>
    </div>
  );
}
export function Modal({
  title,
  description,
  open,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={`dialog ${wide ? "wide" : ""}`}
          aria-describedby={description ? "dialog-description" : undefined}
        >
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description id="dialog-description">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Drawer({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="drawer" aria-describedby={undefined}>
          <Dialog.Title asChild>
            <span className="sr-only">{title}</span>
          </Dialog.Title>
          <Dialog.Close
            className="drawer-close icon-button"
            aria-label="Close candidate"
          >
            <X size={20} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="error-box" role="alert">
      {message}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function SectionTitle({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <h2>
        {title}
        {meta && <span>{meta}</span>}
      </h2>
      {action}
    </div>
  );
}
export function LinkArrow() {
  return <ArrowUpRight size={16} />;
}
export function Toast({ message }: { message: string }) {
  return (
    <div className="toast" role="status">
      <Check size={17} />
      {message}
    </div>
  );
}
