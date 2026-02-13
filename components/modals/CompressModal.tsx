import React from 'react';

const CompressModal = ({ onClose, onConfirm }: { onClose: () => void, onConfirm: (compress: boolean) => void }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[6100]">
            <div className="bg-white p-6 rounded-lg w-80 text-center shadow-xl">
                <h3 className="font-bold text-lg mb-2 text-gray-800">图片处理</h3>
                <p className="text-sm text-gray-600 mb-6">是否启用智能压缩？(推荐：压缩能显著减小体积，加载更快)</p>
                <div className="flex gap-2">
                    <button onClick={() => onConfirm(true)} className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">✅ 是 (压缩)</button>
                    <button onClick={() => onConfirm(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded">否 (原图)</button>
                </div>
            </div>
        </div>
    );
}

export default CompressModal;