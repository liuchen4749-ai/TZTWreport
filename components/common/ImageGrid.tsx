import React, { useState, useRef } from 'react';
import { ImageItem } from '../../types';

const ImageGrid = ({ 
    images, 
    canEdit, 
    onUpdate, 
    onAddClick,
    onImageClick,
    prefix 
}: { 
    images: ImageItem[], 
    canEdit: boolean, 
    onUpdate: (imgs: ImageItem[]) => void, 
    onAddClick: () => void, 
    onImageClick: (img: ImageItem) => void,
    prefix: string
}) => {
    const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = async (index: number) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Audio = reader.result as string;
                    const newImages = [...images];
                    if (!newImages[index].audios) newImages[index].audios = [];
                    newImages[index].audios!.push(base64Audio);
                    onUpdate(newImages);
                    stream.getTracks().forEach(track => track.stop());
                };
                reader.readAsDataURL(blob);
                setRecordingIndex(null);
            };
            mediaRecorder.start();
            setRecordingIndex(index);
        } catch (err) {
            alert("无法访问麦克风");
        }
    };
  
    const stopRecording = () => {
        if (mediaRecorderRef.current && recordingIndex !== null) {
            mediaRecorderRef.current.stop();
        }
    };

    return (
        // Max height constraint for scrolling if more than ~6 images (approx 3 rows)
        <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-2 gap-4">
                {images.map((img, idx) => (
                   <div key={`${prefix}-${idx}`} className="border p-2 rounded bg-white shadow-sm break-inside-avoid">
                     {/* Image Container: Black bg, object-contain to show full image uncropped */}
                     <div className="h-48 bg-black flex items-center justify-center overflow-hidden rounded mb-2 relative group cursor-pointer" onClick={() => onImageClick(img)}>
                       <img src={img.src} alt="" className="w-full h-full object-contain" />
                       {canEdit && (
                         <button 
                            onClick={(e) => { e.stopPropagation(); onUpdate(images.filter((_, i) => i !== idx)); }}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                         >✕</button>
                       )}
                     </div>
                     <div className="mb-2">
                         <input 
                            className="w-full border rounded p-1 text-sm bg-gray-50 mb-1" 
                            placeholder="照片描述..." 
                            value={img.caption}
                            readOnly={!canEdit}
                            onChange={(e) => {
                                const newImages = [...images];
                                newImages[idx].caption = e.target.value;
                                onUpdate(newImages);
                            }}
                         />
                         <div className="flex flex-wrap gap-2 mt-2">
                             {img.audios && img.audios.map((audioSrc, audioIdx) => (
                                 <div key={audioIdx} className="flex items-center gap-1 bg-gray-100 rounded-full px-2 py-1 border">
                                     <audio controls src={audioSrc} className="h-6 w-32" />
                                     {canEdit && <button onClick={() => {
                                         const newImages = [...images];
                                         newImages[idx].audios?.splice(audioIdx, 1);
                                         onUpdate(newImages);
                                     }} className="text-red-500 text-xs">✕</button>}
                                 </div>
                             ))}
                         </div>
                         {canEdit && (
                            <div className="mt-2 flex items-center gap-2">
                                {recordingIndex === idx ? (
                                    <button onClick={stopRecording} className="bg-red-500 text-white px-3 py-1 rounded text-xs animate-pulse w-full">🔴 停止录音</button>
                                ) : (
                                    <button onClick={() => startRecording(idx)} disabled={recordingIndex !== null} className="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1 rounded text-xs w-full hover:bg-blue-100">🎤 添加语音备注</button>
                                )}
                            </div>
                         )}
                     </div>
                   </div>
                ))}
                {canEdit && (
                   <div 
                     onClick={onAddClick}
                     className="border-2 border-dashed border-gray-300 rounded-lg h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-colors text-gray-400"
                   >
                     <i className="fa-solid fa-plus text-2xl mb-1"></i>
                     <span className="text-xs">添加图片</span>
                   </div>
                )}
            </div>
        </div>
    );
};

export default ImageGrid;