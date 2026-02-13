import React, { useState, useMemo } from 'react';
import { User, Project, ProjectTypeDef } from '../../types';

declare const html2pdf: any;

const ExportFilterModal = ({ projects, projectTypes, labelName, currentUser, onClose }: { projects: Project[], projectTypes: ProjectTypeDef[], labelName: string, currentUser: User | null, onClose: () => void }) => {
    const [title, setTitle] = useState('项目清单');

    const handleExport = () => {
        const element = document.getElementById('export-content');
        if (!element) return;
        const opt = {
            margin: 10,
            filename: `${title}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        // @ts-ignore
        if (typeof html2pdf !== 'undefined') html2pdf().set(opt).from(element).save();
    };

    // Filter projects based on Role logic for PDF
    // Admin: All visible projects
    // Editor: Only their own projects
    const exportableProjects = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'admin') return projects;
        if (currentUser.role === 'editor') return projects.filter(p => p.createdBy === currentUser.id);
        return [];
    }, [projects, currentUser]);

    // Group for PDF hierarchy
    const groups: Record<string, Project[]> = {};
    exportableProjects.forEach(p => {
        if(!groups[p.city]) groups[p.city] = [];
        groups[p.city].push(p);
    });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[5000]">
            <div className="bg-white rounded-lg w-[800px] h-[90vh] flex flex-col shadow-xl">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="font-bold text-lg">📄 导出 PDF 预览</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-black text-2xl">✕</button>
                </div>
                
                <div className="p-4 border-b flex gap-4 items-center bg-gray-100">
                    <label className="text-sm font-bold">文档标题:</label>
                    <input className="border p-2 rounded text-sm flex-1" value={title} onChange={e => setTitle(e.target.value)} />
                    <button onClick={handleExport} className="bg-red-600 text-white px-4 py-2 rounded font-bold hover:bg-red-700">⬇️ 下载 PDF</button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
                    <div id="export-content" className="bg-white p-8 shadow-sm min-h-full">
                        <div className="text-3xl font-bold text-center mb-8 border-b pb-4">{title}</div>
                        
                        {Object.entries(groups).map(([city, cityProjects]) => (
                            <div key={city} className="mb-8">
                                <h1 className="text-2xl font-bold text-blue-800 border-b-2 border-blue-800 pb-2 mb-4">{city}</h1>
                                <div className="space-y-6">
                                    {cityProjects.map((p, i) => {
                                        const typeDef = projectTypes.find(t => t.key === p.type);
                                        // Logic for showing internal info:
                                        // Admin: Always show.
                                        // Editor: Show if they created it.
                                        const showInternal = currentUser?.role === 'admin' || (currentUser?.role === 'editor' && p.createdBy === currentUser.id);

                                        return (
                                            <div key={p.id} className="border-b pb-4 break-inside-avoid">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h2 className="text-xl font-bold flex items-center gap-2">
                                                            {i + 1}. {p.name}
                                                            <span className={`text-sm px-2 py-0.5 rounded border font-normal ${typeDef?.bgColorClass}`}>{typeDef?.label || p.type}</span>
                                                        </h2>
                                                        <div className="text-sm text-gray-500 mt-1">
                                                            <span className="mr-4">🏷️ {p.label}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Public Description */}
                                                {p.publicDescription && (
                                                    <div className="text-sm text-gray-700 mb-3 bg-gray-50 p-3 rounded">
                                                        <span className="font-bold block mb-1 text-gray-500">项目概况:</span>
                                                        {p.publicDescription}
                                                    </div>
                                                )}

                                                {/* Public Images */}
                                                {p.images && p.images.length > 0 && (
                                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                                        {p.images.map((img, idx) => (
                                                            <div key={idx} className="bg-gray-50 p-2 rounded">
                                                                <img 
                                                                    src={img.src} 
                                                                    className="w-auto max-w-full max-h-[300px] object-contain mx-auto" 
                                                                    alt={img.caption} 
                                                                />
                                                                {img.caption && <div className="text-center text-xs text-gray-600 mt-1">{img.caption}</div>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Internal Info Section (Conditional) */}
                                                {showInternal && (p.internalDescription || (p.internalImages && p.internalImages.length > 0)) && (
                                                    <div className="border border-orange-200 bg-orange-50 rounded p-3 mt-4">
                                                        <div className="text-orange-800 font-bold text-sm mb-2 border-b border-orange-200 pb-1">🔒 内部资料 (Internal)</div>
                                                        
                                                        {p.internalDescription && (
                                                            <div className="text-sm text-gray-800 mb-3 whitespace-pre-wrap">
                                                                {p.internalDescription}
                                                            </div>
                                                        )}

                                                        {p.internalImages && p.internalImages.length > 0 && (
                                                            <div className="grid grid-cols-2 gap-4">
                                                                {p.internalImages.map((img, idx) => (
                                                                    <div key={idx} className="bg-white p-2 rounded border border-orange-100">
                                                                        <img 
                                                                            src={img.src} 
                                                                            className="w-auto max-w-full max-h-[300px] object-contain mx-auto" 
                                                                            alt={img.caption} 
                                                                        />
                                                                        {img.caption && <div className="text-center text-xs text-gray-600 mt-1">{img.caption}</div>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        <div className="mt-8 text-center text-gray-400 text-xs">
                            Generated by TZTW Project Manager
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExportFilterModal;