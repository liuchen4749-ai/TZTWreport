import React, { useState } from 'react';
import { Project, ProjectTypeDef } from '../../types';
import { generateStandaloneHTML } from '../../utils/htmlGenerator';

const ExportHTMLModal = ({ projects, projectTypes, onClose }: { projects: Project[], projectTypes: ProjectTypeDef[], onClose: () => void }) => {
    const [title, setTitle] = useState('项目考察备份');
    const [permission, setPermission] = useState<'admin' | 'guest'>('guest');

    const handleExport = () => {
        // Only include selected projects passed via props
        const htmlContent = generateStandaloneHTML(projects, projectTypes, title, permission);
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}_${permission}_v${new Date().toISOString().slice(0,10)}.html`;
        a.click();
        URL.revokeObjectURL(url);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[5000]">
            <div className="bg-white rounded-lg w-96 p-6 shadow-xl">
                <h2 className="text-xl font-bold mb-4">🌍 导出独立 HTML 网页</h2>
                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-1">网页标题</label>
                    <input className="w-full border p-2 rounded" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-700 mb-2">内容权限 (导出后无法修改)</label>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                            <input type="radio" name="perm" checked={permission === 'guest'} onChange={() => setPermission('guest')} />
                            <div>
                                <div className="font-bold text-sm">👁️ 游客权限</div>
                                <div className="text-xs text-gray-500">仅包含公共资料，隐藏内部信息</div>
                            </div>
                        </label>
                        <label className="flex items-center gap-2 p-2 border rounded hover:bg-red-50 cursor-pointer border-red-200">
                            <input type="radio" name="perm" checked={permission === 'admin'} onChange={() => setPermission('admin')} />
                            <div>
                                <div className="font-bold text-sm text-red-600">🔒 主管理员权限</div>
                                <div className="text-xs text-gray-500">包含所有内部资料、附件、图片</div>
                            </div>
                        </label>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600">取消</button>
                    <button onClick={handleExport} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">⬇️ 导出网页</button>
                </div>
            </div>
        </div>
    );
};

export default ExportHTMLModal;