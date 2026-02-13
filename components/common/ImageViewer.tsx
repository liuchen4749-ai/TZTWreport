import React, { useState, useRef } from 'react';

const ImageViewer = ({ src, onClose }: { src: string, onClose: () => void }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [start, setStart] = useState({ x: 0, y: 0 });
    const imgRef = useRef<HTMLImageElement>(null);

    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setScale(s => Math.min(Math.max(s * delta, 0.5), 5));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setDragging(true);
        setStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };
    
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragging) return;
        setPosition({ x: e.clientX - start.x, y: e.clientY - start.y });
    };

    const handleMouseUp = () => setDragging(false);

    // Touch support for mobile pan
    const handleTouchStart = (e: React.TouchEvent) => {
        setDragging(true);
        setStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
    };
    
    const handleTouchMove = (e: React.TouchEvent) => {
        if(!dragging) return;
        setPosition({ x: e.touches[0].clientX - start.x, y: e.touches[0].clientY - start.y });
    };

    return (
        <div className="fixed inset-0 bg-black z-[7000] flex flex-col overflow-hidden" onWheel={handleWheel}>
            <div className="flex justify-end p-4 absolute top-0 right-0 z-50">
                <button onClick={onClose} className="bg-white/20 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center backdrop-blur-sm">✕</button>
            </div>
            <div 
                className="flex-1 flex items-center justify-center cursor-move overflow-hidden"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleMouseUp}
            >
                <img 
                    ref={imgRef}
                    src={src} 
                    style={{ 
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transition: dragging ? 'none' : 'transform 0.1s' 
                    }}
                    className="max-w-full max-h-full object-contain pointer-events-none select-none"
                    draggable={false}
                />
            </div>
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4 z-50">
                 <button onClick={() => { setScale(1); setPosition({x:0,y:0}); }} className="bg-white/20 text-white px-4 py-2 rounded-full backdrop-blur-sm text-sm">重置</button>
                 <button onClick={() => setScale(s => Math.max(s/1.2, 0.5))} className="bg-white/20 text-white w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center font-bold text-lg">-</button>
                 <button onClick={() => setScale(s => Math.min(s*1.2, 5))} className="bg-white/20 text-white w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center font-bold text-lg">+</button>
            </div>
        </div>
    )
}

export default ImageViewer;