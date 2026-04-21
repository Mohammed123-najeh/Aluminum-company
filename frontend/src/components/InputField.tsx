import React from 'react';

type InputFieldProps = {
  label: string;
  type?: string;
  name: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  error?: string;
};

export const InputField: React.FC<InputFieldProps> = ({
  label,
  type = 'text',
  name,
  placeholder,
  value,
  onChange,
  icon,
  error,
}) => {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-xs font-medium tracking-wide text-slate-500"
      >
        {label}
      </label>
      <div
        className="group relative flex items-center rounded-lg border border-slate-300/70 bg-white/80 px-3 py-2 text-sm shadow-sm
                   transition hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20"
      >
        {icon ? (
          <span className="mr-2 text-slate-400 group-focus-within:text-blue-500">
            {icon}
          </span>
        ) : null}
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-slate-800 placeholder:text-slate-400 outline-none"
        />
      </div>
      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : null}
    </div>
  );
};

