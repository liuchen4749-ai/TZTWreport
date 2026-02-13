import React, { useState, useRef, useEffect } from 'react';

interface Option {
    value: string;
    label: string;
}

interface MultiSelectProps {
    label: string;
    options: Option[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
}

const MultiSelect = ({ label, options, selectedValues, onChange }: MultiSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (value: string) => {
        if (selectedValues.includes(value)) {
            onChange(selectedValues.filter(v => v !== value));
        } else {
            onChange([...selectedValues, value]);
        }
    };

    const handleSelectAll = () => {
        // If all are selected, deselect all. Otherwise, select all.
        if (selectedValues.length === options.length) {
            onChange([]);
        } else {
            onChange(options.map(o => o.value));
        }
    };

    // If array is empty, we treat it as "All" for logic, so we display "All".
    // If user manually selected all items, we also show "All".
    const isAllSelected = selectedValues.length === 0 || selectedValues.length === options.length;

    const displayText = isAllSelected 
        ? `全部${label}` 
        : `${label} (${selectedValues.length})`;

    return (
        <div className="relative flex-1 min-w-[80px]" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className={`w-full p-1 rounded text-xs flex justify-between items-center border ${
                    !isAllSelected ? 'bg-blue-50 border-blue-300 text-black font-bold' : 'bg-white border-gray-300 text-black'
                }`}
            >
                <span className="truncate mr-1">{displayText}</span>
                <i className="fa-solid fa-chevron-down text-[10px]"></i>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 w-full min-w-[160px] bg-white border border-gray-300 shadow-xl rounded mt-1 z-[2000] max-h-60 overflow-y-auto">
                    <div 
                        className="p-2 hover:bg-gray-100 cursor-pointer flex items-center border-b bg-gray-50"
                        onClick={handleSelectAll}
                    >
                        <input 
                            type="checkbox" 
                            checked={isAllSelected} 
                            readOnly
                            className="mr-2 cursor-pointer" 
                        />
                        <span className="text-xs font-bold text-black">全选 (All)</span>
                    </div>
                    {options.map(opt => (
                        <div 
                            key={opt.value} 
                            className="p-2 hover:bg-gray-100 cursor-pointer flex items-center border-b border-gray-50 last:border-0"
                            onClick={() => toggleOption(opt.value)}
                        >
                            <input 
                                type="checkbox" 
                                checked={selectedValues.includes(opt.value)} 
                                readOnly
                                className="mr-2 cursor-pointer" 
                            />
                            <span className="text-xs truncate text-black" title={opt.label}>{opt.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MultiSelect;