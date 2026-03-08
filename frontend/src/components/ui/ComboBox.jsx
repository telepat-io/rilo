import { useState, useRef, useEffect } from 'react';

/**
 * Searchable combo-box: shows a filtered dropdown when focused,
 * allows clicking to select, and still accepts free-text custom values.
 *
 * Props:
 *   id, value, onChange, options (string[]), placeholder, className,
 *   inputStyle, getOptionStyle(option), renderOption(option)
 */
export function ComboBox({
  id,
  value,
  onChange,
  options = [],
  placeholder,
  className,
  inputStyle,
  getOptionStyle,
  renderOption
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value ?? '');
  const containerRef = useRef(null);

  // Keep query in sync when value changes externally
  useEffect(() => {
    setQuery(value ?? '');
  }, [value]);

  const normalizedQuery = query.trim().toLowerCase();
  const orderedOptions = normalizedQuery
    ? [
      ...options.filter((option) => option.toLowerCase().includes(normalizedQuery)),
      ...options.filter((option) => !option.toLowerCase().includes(normalizedQuery))
    ]
    : options;

  function handleInputChange(event) {
    const v = event.target.value;
    setQuery(v);
    onChange(v || undefined);
    setOpen(true);
  }

  function handleSelect(option) {
    setQuery(option);
    onChange(option);
    setOpen(false);
  }

  function handleBlur(event) {
    // Only close if focus leaves the whole container
    if (!containerRef.current?.contains(event.relatedTarget)) {
      setOpen(false);
    }
  }

  return (
    <div className="combo-box" ref={containerRef} onBlur={handleBlur}>
      <input
        id={id}
        type="text"
        className={className}
        style={inputStyle}
        placeholder={placeholder}
        value={query}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={handleInputChange}
      />
      {open && orderedOptions.length > 0 && (
        <ul className="combo-box-list" role="listbox">
          {orderedOptions.map((option) => (
            <li
              key={option}
              role="option"
              aria-selected={option === value}
              className={`combo-box-option${option === value ? ' combo-box-option--active' : ''}`}
              style={typeof getOptionStyle === 'function' ? getOptionStyle(option) : undefined}
              onMouseDown={(event) => {
                // prevent input blur before click fires
                event.preventDefault();
                handleSelect(option);
              }}
            >
              {typeof renderOption === 'function' ? renderOption(option) : option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
