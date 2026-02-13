import React, { useState, useRef } from 'react';
import { User } from '../../types';

const ExportDropdown = ({ onExportJSON, onExportPDF, onExportHTML, onImportJSON, currentUser }: { onExportJSON: () => void, onExportPDF: () => void, onExportHTML: () => void, onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void, currentUser: User | null }) => {
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef<any>(null);

    const handleEnter = () => {
        if(timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsOpen(true);
    };

    const handleLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 800); // 800ms delay
    };

    return (
        <div className="relative flex-1" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
            <button className="w-full bg-[#27ae60] text-white py-1 px-2 rounded text-xs font-bold flex items-center justify-center gap-1">📚 导出/导入 ▾</button>
            {isOpen && (
                <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded mt-1 z-[1001] text-gray-800 text-sm">
                    <button className="block w-full text-left px-4 py-2 hover:bg-gray-100" onClick={onExportPDF}>📄 导出 PDF</button>
                    {/* Only Main Admin can export HTML */}
                    {currentUser?.role === 'admin' && (
                        <button className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-blue-600 font-bold" onClick={onExportHTML}>🌍 导出独立网页</button>
                    )}
                    <button className="block w-full text-left px-4 py-2 hover:bg-gray-100" onClick={onExportJSON}>💾 导出 JSON</button>
                    <label className="block w-full text-left px-4 py-2 hover:bg-gray-100 cursor-pointer">
                        📂 导入 JSON
                        <input type="file" accept=".json" className="hidden" onChange={onImportJSON}/>
                    </label>
                </div>
            )}
        </div>
    );
};

export default ExportDropdown;