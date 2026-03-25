"use client";

import { useState, useRef, useEffect } from "react";

interface ModelTypeSelectorProps {
  availableModelTypes: string[];
  selectedModelType: string;
  onSelect: (modelType: string) => void;
  className?: string;
  dropdownDirection?: "up" | "down"; // "up" for chat, "down" for draft
}

export default function ModelTypeSelector({
  availableModelTypes,
  selectedModelType,
  onSelect,
  className = "",
  dropdownDirection = "down",
}: ModelTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  // Close selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={selectorRef}>
      <label className="block text-sm font-medium text-text-primary mb-2">
        Выбор модели
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[var(--border)] rounded bg-[var(--input-background)] text-text-primary hover:bg-text-primary/5 transition-colors w-full"
        title="Выбрать модель"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="font-medium capitalize flex-1 text-left">
          {selectedModelType || "Standard"}
        </span>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
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

      {/* Model Selector Dropdown */}
      {isOpen && availableModelTypes.length > 0 && (
        <div className={`absolute left-0 w-full bg-[var(--surface)] rounded-lg border-2 border-[var(--border)] shadow-xl z-50 ${
          dropdownDirection === "up" 
            ? "bottom-full mb-2" 
            : "top-full mt-2"
        }`}>
          <div className="py-1">
            {availableModelTypes.map((modelType) => (
              <button
                key={modelType}
                onClick={() => {
                  onSelect(modelType);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-text-primary/5 transition-colors ${
                  selectedModelType === modelType
                    ? "bg-text-primary/10 font-semibold text-text-primary"
                    : "text-text-secondary"
                }`}
              >
                <span className="capitalize">{modelType}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

