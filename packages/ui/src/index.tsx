import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Button({ className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <button className={`mk-button mk-button--${variant} ${className}`} {...props} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mk-card ${className}`}>{children}</section>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'success' | 'danger' }) {
  return <span className={`mk-badge mk-badge--${tone}`}>{children}</span>;
}

export function Field({ label, icon, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: ReactNode; error?: string }) {
  return (
    <label className="mk-field">
      <span className="mk-field__label">{label}</span>
      <span className={`mk-field__control ${error ? 'mk-field__control--error' : ''}`}>
        {icon}<input {...props} aria-invalid={Boolean(error)} />
      </span>
      {error && <span className="mk-field__error">{error}</span>}
    </label>
  );
}
