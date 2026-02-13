import React, { useState } from 'react';
import L from 'leaflet';

const MapSearch = ({ map }: { map: L.Map | null }) => {
    const [query, setQuery] = useState('');
    
    const handleSearch = async (e?: React.FormEvent) => {
        if(e) e.preventDefault();
        if(!query.trim() || !map) return;
        
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if(data && data.length > 0) {
                const { lat, lon } = data[0];
                map.setView([parseFloat(lat), parseFloat(lon)], 13);
            } else {
                alert("未找到该地点，请尝试其他关键词");
            }
        } catch(err) {
            alert("搜索失败，请检查网络连接");
        }
    };

    return (
        <div className="absolute top-2 right-2 z-[1000] bg-white p-1 rounded shadow-md flex">
            <form onSubmit={handleSearch} className="flex">
                <input 
                    type="text" 
                    className="p-1 px-2 text-sm outline-none w-40" 
                    placeholder="输入地名搜索..." 
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
                <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                    <i className="fa-solid fa-search"></i>
                </button>
            </form>
        </div>
    );
};

export default MapSearch;