import { Eye, EyeOff, Lock } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  id: string;
  label: string;
}

export default function PasswordField({ id, label, ...inputProps }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const visibilityLabel = `${isVisible ? "Hide" : "Show"} ${label.toLowerCase()}`;

  return (
    <div className="auth-field">
      <label className="text-[13px] font-bold text-foreground" htmlFor={id}>{label}</label>
      <div className="auth-input-wrap has-action">
        <Lock size={18} aria-hidden="true" />
        <input id={id} type={isVisible ? "text" : "password"} {...inputProps} />
        <button
          type="button"
          className="absolute right-0 flex size-12 items-center justify-center rounded-r-[10px] text-muted-foreground hover:text-foreground focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-label={visibilityLabel}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((visible) => !visible)}
        >
          {isVisible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
