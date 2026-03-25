"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

// Portal component to render dropdown outside parent constraints
function DropdownPortal({
  inputElement,
  onClose,
  children,
}: {
  inputElement: HTMLInputElement;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    function updatePosition() {
      const rect = inputElement.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [inputElement, mounted]);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed z-[9999]"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

interface Item {
  code?: string;
  name: string;
  fullPath?: string;
}

interface MultiSelectSearchInputProps {
  items: Item[];
  selectedItems: string[];
  onChange: (items: string[]) => void;
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  getItemKey: (item: Item) => string;
  getItemDisplay: (item: Item) => React.ReactNode;
  filterItem: (item: Item, searchTerm: string) => boolean;
  getSelectedItemDisplay?: (key: string, item: Item | undefined) => React.ReactNode;
}

export default function MultiSelectSearchInput({
  items,
  selectedItems,
  onChange,
  label,
  placeholder = "Начните вводить для поиска...",
  searchPlaceholder = "Поиск...",
  getItemKey,
  getItemDisplay,
  filterItem,
  getSelectedItemDisplay,
}: MultiSelectSearchInputProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const isOpen = isFocused || searchTerm.length > 0;
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      
      // Check if click is outside both the container and the dropdown
      const clickedInContainer = containerRef.current?.contains(target);
      const clickedInDropdown = dropdownRef.current?.contains(target);
      
      // Close if clicked outside both
      if (!clickedInContainer && !clickedInDropdown) {
        setIsFocused(false);
        setSearchTerm("");
      }
    }

    // Use a small delay to avoid closing immediately when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFocused, searchTerm]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    return items.filter((item) => filterItem(item, searchTerm.toLowerCase()));
  }, [items, searchTerm, filterItem]);

  const handleToggle = (key: string) => {
    if (selectedItems.includes(key)) {
      onChange(selectedItems.filter((k) => k !== key));
    } else {
      onChange([...selectedItems, key]);
    }
  };

  const handleToggleDropdown = () => {
    setIsFocused(!isFocused);
    if (isFocused) {
      setSearchTerm("");
    }
  };

  const showDropdown = isFocused || searchTerm.length > 0;

  return (
    <div className="mb-4" ref={containerRef}>
      <label className="block text-sm font-medium text-black dark:text-white mb-2">
        {label} *
      </label>
      
      {/* Search Input - Always Visible */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          className="w-full px-4 pr-10 py-2 border-2 border-black/25 dark:border-white/25 rounded-lg bg-white dark:bg-zinc-900 text-black dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-colors"
        />
        {/* Toggle Button */}
        <button
          type="button"
          onClick={handleToggleDropdown}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
          title={isFocused ? "Закрыть" : "Открыть"}
        >
          <svg
            className={`w-5 h-5 text-black dark:text-white transition-transform ${isFocused ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Dropdown */}
        {showDropdown && inputRef.current && (
          <DropdownPortal
            inputElement={inputRef.current}
            onClose={() => setIsFocused(false)}
          >
            <div
              ref={dropdownRef}
              className="bg-white dark:bg-zinc-900 border-2 border-black/25 dark:border-white/25 rounded-lg shadow-xl max-h-80 overflow-hidden flex flex-col"
              style={{ width: inputRef.current.offsetWidth }}
            >
              <div className="overflow-y-auto max-h-64 p-2">
              {filteredItems.length === 0 ? (
                <div className="px-4 py-2 text-zinc-500 dark:text-zinc-400 text-sm">
                  Ничего не найдено
                </div>
              ) : (
                filteredItems.map((item) => {
                  const key = getItemKey(item);
                  const isSelected = selectedItems.includes(key);
                  return (
                    <label
                      key={key}
                      className="flex items-start gap-2 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggle(key)}
                        className="mt-1 w-4 h-4 text-black dark:text-white border-2 border-black/25 dark:border-white/25 rounded focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
                      />
                      <span className="text-sm text-black dark:text-white flex-1">
                        {getItemDisplay(item)}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            
            {/* Selected Items Footer */}
            {selectedItems.length > 0 && (
              <div className="p-2 border-t-2 border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5">
                <div className="text-xs text-black dark:text-white font-medium mb-1">
                  {(() => {
                    // Try to extract leading numbers before a dot (e.g., "3." from "3. Something")
                    const numbers = selectedItems
                      .map((key) => {
                        const match = key.match(/^(\d+)\./);
                        return match ? match[1] : null;
                      })
                      .filter((n): n is string => n !== null);

                    if (numbers.length > 0) {
                      return <>Выбрано: {numbers.join(", ")}</>;
                    }

                    // Fallback: just show count for non-numbered items (e.g., ОКЭД коды)
                    return <>Выбрано: {selectedItems.length}</>;
                  })()}
                </div>
              </div>
            )}
            </div>
          </DropdownPortal>
        )}
      </div>

      {/* Selected Items Display */}
      {selectedItems.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedItems.map((key) => {
            const item = items.find((i) => getItemKey(i) === key);
            const displayText = getSelectedItemDisplay
              ? getSelectedItemDisplay(key, item)
              : key;
            
            return (
              <span
                key={key}
                className="px-3 py-1.5 bg-black/10 dark:bg-white/10 rounded text-sm text-black dark:text-white flex items-center gap-2"
              >
                {displayText}
                <button
                  type="button"
                  onClick={() => handleToggle(key)}
                  className="hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Validation Message */}
      {selectedItems.length === 0 && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400">
          Необходимо выбрать хотя бы один элемент
        </p>
      )}
    </div>
  );
}

