import React from 'react';

const SourceModal = ({ onClose, onSelect }: { onClose: () => void, onSelect: (source: 'camera' | 'album') => void }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[6000]">
            <div className="bg-white p-6 rounded-lg w-80 text-center shadow-xl">
                <h3 className="font-bold text-lg mb-4 text-gray-800">选择图片来源</h3>
                <div className="flex gap-4">
                    <button onClick={() => onSelect('album')} className="flex-1 p-4 border rounded hover:bg-gray-50 flex flex-col items-center gap-2">
                        <i className="fa-regular fa-images text-2xl text-green-600"></i>
                        <span className="text-sm">手机相册</span>
                    </button>
                    <button onClick={() => onSelect('camera')} className="flex-1 p-4 border rounded hover:bg-gray-50 flex flex-col items-center gap-2">
                        <i className="fa-solid fa-camera text-2xl text-blue-600"></i>
                        <span className="text-sm">现场拍照</span>
                    </button>
                </div>
                <button onClick={onClose} className="mt-4 text-gray-500 text-sm">取消</button>
            </div>
        </div>
    );
}

export default SourceModal;