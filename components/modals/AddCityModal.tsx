import React, { useState } from 'react';

const AddCityModal = ({ 
    onClose, 
    onConfirm 
}: { 
    onClose: () => void, 
    onConfirm: (city: string) => void 
}) => {
    const [city, setCity] = useState('');

    const handleSubmit = () => {
        if (!city.trim()) return alert("请填写城市名称");
        onConfirm(city);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[5000]">
            <div className="bg-white p-6 rounded-lg w-80 shadow-xl">
                <h2 className="text-xl font-bold mb-4 text-gray-800">新增城市</h2>
                <label className="block text-xs font-bold text-gray-600 mb-1">城市名称</label>
                <input className="w-full border p-2 mb-4 rounded" placeholder="例如: 北京" value={city} onChange={e => setCity(e.target.value)} />
                <div className="text-xs text-gray-500 mb-4">
                    注：将自动创建“新建项目”以初始化该城市。
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600">取消</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded">确定</button>
                </div>
            </div>
        </div>
    );
};

export default AddCityModal;