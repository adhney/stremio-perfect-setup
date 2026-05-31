import type { ReactNode } from 'react';
import { ArrowRight, Check, Save } from 'lucide-react';

interface Props {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  icon?: ReactNode;
}

function getDefaultIcon(label: string) {
  if (/finish/i.test(label)) return <Check size={16} />;
  if (/save/i.test(label)) return <Save size={16} />;
  return <ArrowRight size={16} />;
}

export function NextButton({ onClick, disabled = false, label = 'Continue', icon }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', marginTop: '1.5rem',
        padding: '0.75rem 1.5rem',
        background: disabled
          ? 'var(--border)'
          : 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
        color: disabled ? 'var(--muted)' : '#ffffff',
        fontWeight: 600, fontSize: '0.95rem',
        borderRadius: '10px', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
        boxShadow: disabled ? 'none' : '0 4px 14px rgba(109, 58, 242, 0.3)',
        transition: 'opacity 0.15s, transform 0.1s',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseOver={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
      onMouseOut={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
      onMouseDown={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)'; }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
    >
      <span>{label}</span>
      {icon ?? getDefaultIcon(label)}
    </button>
  );
}
