"use client";

import { useState, useRef, useEffect } from "react";

export interface DropdownOption {
  value: string;
  label: string;
  searchText: string;
}

interface SearchableDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export default function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = "Выберите...",
  label,
  className = "",
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find selected option
  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search term
  const filteredOptions = options.filter((option) =>
    option.searchText.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (option: DropdownOption) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm("");
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-black dark:text-white mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-2 border-2 border-black/25 dark:border-white/25 rounded-lg bg-white dark:bg-zinc-900 text-black dark:text-white text-left flex items-center justify-between focus:outline-none focus:border-black dark:focus:border-white focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-colors"
        >
          <span className={selectedOption ? "" : "text-zinc-500 dark:text-zinc-400"}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
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

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border-2 border-black/25 dark:border-white/25 rounded-lg shadow-xl max-h-60 overflow-hidden flex flex-col">
            <div className="p-2 border-b-2 border-black/15 dark:border-white/15">
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Поиск..."
                className="w-full px-3 py-2 border border-black/20 dark:border-white/20 rounded bg-white dark:bg-zinc-900 text-black dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:border-black dark:focus:border-white"
              />
            </div>
            <div className="overflow-y-auto max-h-48">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-2 text-zinc-500 dark:text-zinc-400 text-sm">
                  Ничего не найдено
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      index === highlightedIndex || option.value === value
                        ? "bg-black/10 dark:bg-white/10"
                        : "hover:bg-black/5 dark:hover:bg-white/5"
                    } ${
                      option.value === value
                        ? "text-black dark:text-white font-medium"
                        : "text-black dark:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

