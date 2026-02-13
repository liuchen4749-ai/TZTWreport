import React, { useState } from 'react';
import { User, ProjectTypeDef } from '../../types';

const AddProjectModal = ({ 
    initialCity, 
    labelName,
    availableCities,
    availableLabels,
    projectTypes,
    currentUser,
    onClose, 
    onConfirm,
    onAddType
}: { 
    initialCity: string | null, 
    labelName: string,
    availableCities: string[],
    availableLabels: string[],
    projectTypes: ProjectTypeDef[],
    currentUser: User | null,
    onClose: () => void, 
    onConfirm: (city: string, name: string, type: string, label: string) => void,
    onAddType: (newType: ProjectTypeDef) => void
}) => {
    // Reorder: Name first, then City
    const [name, setName] = useState('');
    const [city, setCity] = useState(initialCity || (availableCities[0] || ''));
    const [type, setType] = useState(projectTypes[0]?.key || 'Commercial');
    const [label, setLabel] = useState('大名考察');

    const isAdmin = currentUser?.role === 'admin';

    const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (e.target.value === '__NEW__') {
            const newCity = prompt("请输入新城市名称:");
            if (newCity && newCity.trim()) {
                setCity(newCity.trim());
            }
        } else {
            setCity(e.target.value);
        }
    };

    const handleLabelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (e.target.value === '__NEW__') {
            const newLabel = prompt("请输入新项目类别:");
            if (newLabel && newLabel.trim()) {
                setLabel(newLabel.trim());
            }
        } else {
            setLabel(e.target.value);
        }
    };

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (e.target.value === '__NEW_TYPE__') {
            const newLabel = prompt("请输入新项目类型名称 (如: 产业园):");
            if (newLabel && newLabel.trim()) {
                // Generate a key and color
                const key = 'Type_' + Date.now();
                const colors = ['#e74c3c', '#8e44ad', '#3498db', '#1abc9c', '#f1c40f', '#e67e22', '#34495e'];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                
                const newTypeDef: ProjectTypeDef = {
                    key,
                    label: newLabel.trim(),
                    color: randomColor,
                    bgColorClass: 'bg-gray-100 text-gray-800 border-gray-200' // Default style
                };
                onAddType(newTypeDef);
                setType(key);
            }
        } else {
            setType(e.target.value);
        }
    };

    const handleSubmit = () => {
        if (!city.trim() || !name.trim()) return alert("请填写完整信息");
        onConfirm(city, name, type, label);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[5000]">
            <div className="bg-white p-6 rounded-lg w-80 shadow-xl">
                <h2 className="text-xl font-bold mb-4 text-gray-800">新增项目</h2>
                
                <label className="block text-xs font-bold text-gray-600 mb-1">项目名称</label>
                <input className="w-full border p-2 mb-2 rounded" placeholder="项目名称" value={name} onChange={e => setName(e.target.value)} />

                <label className="block text-xs font-bold text-gray-600 mb-1">城市名称</label>
                <select className="w-full border p-2 mb-2 rounded" value={availableCities.includes(city) ? city : '__CUSTOM__'} onChange={handleCityChange}>
                    {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                    {!availableCities.includes(city) && city && <option value="__CUSTOM__">{city}</option>}
                    <option value="__NEW__" className="font-bold text-blue-600">[ + 添加新城市... ]</option>
                </select>

                <label className="block text-xs font-bold text-gray-600 mb-1">项目类型</label>
                <select className="w-full border p-2 mb-2 rounded" value={type} onChange={handleTypeChange}>
                    {projectTypes.map(t => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                    {isAdmin && <option value="__NEW_TYPE__" className="font-bold text-green-600">[ + 添加新类型... ]</option>}
                </select>

                <label className="block text-xs font-bold text-gray-600 mb-1">{labelName}</label>
                <select className="w-full border p-2 mb-4 rounded" value={availableLabels.includes(label) ? label : '__CUSTOM__'} onChange={handleLabelChange}>
                    {availableLabels.map(l => <option key={l} value={l}>{l}</option>)}
                    {!availableLabels.includes(label) && label && <option value="__CUSTOM__">{label}</option>}
                    <option value="__NEW__" className="font-bold text-blue-600">[ + 添加新{labelName}... ]</option>
                </select>

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600">取消</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded">确定</button>
                </div>
            </div>
        </div>
    );
};

export default AddProjectModal;