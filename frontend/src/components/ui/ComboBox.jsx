import { useState, useRef, useEffect } from 'react';

/**
 * Searchable combo-box: shows a filtered dropdown when focused,
 * allows clicking to select, and still accepts free-text custom values.
 *
 * Props:
 *   id, value, onChange, options (string[]), placeholder, className
 */
export function ComboBox({ id, value, onChange, options = [], placeholder, className }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value ?? '');
  const containerRef = useRef(null);

  // Keep query in sync when value changes externally
  useEffect(() => {
    setQuery(value ?? '');
  }, [value]);

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
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
        placeholder={placeholder}
        value={query}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={handleInputChange}
      />
      {open && filtered.length > 0 && (
        <ul className="combo-box-list" role="listbox">
          {filtered.map((option) => (
            <li
              key={option}
              role="option"
              aria-selected={option === value}
              className={`combo-box-option${option === value ? ' combo-box-option--active' : ''}`}
              onMouseDown={(event) => {
                // prevent input blur before click fires
                event.preventDefault();
                handleSelect(option);
              }}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
