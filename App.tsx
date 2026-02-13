import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { db } from './services/mockDb';
import { Project, User, ImageItem, Attachment, ProjectTypeDef } from './types';

// Declare html2pdf for TypeScript
declare const html2pdf: any;

// Markers Scaled to 0.8x of previous 2x (28px -> ~22px)
const createCustomIcon = (color: string, isActive: boolean = false) => {
  const scale = isActive ? 1.2 : 1; 
  const borderColor = isActive ? '#00FF00' : 'white';
  const shadow = isActive ? '0 0 10px yellow' : '0 0 5px black';
  
  // Size 22px
  return L.divIcon({
    className: `custom-icon ${isActive ? 'active-marker' : ''}`,
    html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:2px solid ${borderColor};box-shadow:${shadow};transform:scale(${scale});"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
};

// --- Helper Functions ---

const generateStandaloneHTML = (projects: Project[], projectTypes: ProjectTypeDef[], title: string, permission: 'admin' | 'guest') => {
    // 1. Filter Data based on permission
    // Note: Admin permission EXPLICITLY keeps internal fields.
    const safeData = projects.map(p => {
        const copy = { ...p };
        if (permission === 'guest') {
            delete copy.internalDescription;
            delete copy.internalImages;
            delete copy.attachments;
            delete copy.createdBy;
            delete copy.createdByName;
        }
        return copy;
    });

    // Extract unique values for filters in the exported file
    const cities = Array.from(new Set(safeData.map(p => p.city))).sort();
    const labels = Array.from(new Set(safeData.map(p => p.label))).sort();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <style>
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; }
        ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }
        .leaflet-popup-content-wrapper { border-radius: 6px; padding: 0; }
        .leaflet-popup-content { margin: 0; width: 240px !important; }
        .custom-icon { transition: all 0.2s; }
        .active-marker { z-index: 1000 !important; }
    </style>
</head>
<body class="bg-gray-100 h-screen w-screen flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="bg-[#2c3e50] text-white p-4 shrink-0 flex justify-between items-center shadow z-20">
        <div class="flex items-center gap-4">
            <h1 class="text-lg font-bold">TZTW 考察系统 - ${title}</h1>
            <div class="text-xs bg-blue-600 px-2 py-1 rounded">
                ${permission === 'admin' ? '🔒 管理员视图' : '👁️ 游客视图'}
            </div>
        </div>
        <div class="flex gap-2">
            <button onclick="openGuideModal()" class="bg-[#f39c12] text-white px-3 py-1 rounded text-xs font-bold hover:bg-yellow-600">🗺️ 旅行条件</button>
            <button onclick="openExportModal()" class="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-700">📄 导出 PDF</button>
        </div>
    </div>

    <div class="flex flex-1 overflow-hidden" id="mainContainer">
        <!-- Sidebar -->
        <div id="sidebarPanel" style="width: 33.33%; min-width: 250px;" class="bg-white flex flex-col border-r shadow z-10">
            <!-- Search & Filters -->
            <div class="p-2 border-b bg-[#34495e] flex flex-col gap-2">
                <input id="searchInput" type="text" placeholder="🔍 搜索项目..." class="w-full p-2 rounded text-sm">
                <div class="flex gap-1 text-xs">
                    <select id="filterCity" class="flex-1 p-1 rounded"><option value="all">全部城市</option></select>
                    <select id="filterType" class="flex-1 p-1 rounded"><option value="all">全部类型</option></select>
                </div>
                <select id="filterLabel" class="w-full p-1 rounded text-xs"><option value="all">全部属性</option></select>
            </div>
            <div id="sidebarContent" class="flex-1 overflow-y-auto"></div>
            <div class="p-4 bg-white border-t">
                <button onclick="addNewCity()" class="w-full bg-[#8e44ad] text-white py-2 rounded font-bold text-sm hover:bg-[#732d91]"><i class="fa-solid fa-city"></i> 新增城市</button>
            </div>
        </div>
        
        <!-- Resizer Handle -->
        <div id="resizer" class="w-[10px] bg-[#f1f1f1] border-l border-r border-gray-300 cursor-col-resize flex items-center justify-center z-[1001] hover:bg-gray-200 select-none">
            <span class="text-gray-400 text-[10px] tracking-widest pointer-events-none">||</span>
        </div>

        <!-- Map -->
        <div id="map" class="flex-1 z-0 relative">
             <!-- Map Search Overlay -->
             <div class="absolute top-2 right-2 z-[1000] bg-white p-1 rounded shadow-md flex">
                <input id="mapSearchInput" type="text" class="p-1 px-2 text-sm outline-none w-40" placeholder="输入地名搜索..." onkeydown="if(event.key==='Enter') searchMap()">
                <button onclick="searchMap()" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                    <i class="fa-solid fa-search"></i>
                </button>
            </div>
        </div>
    </div>

    <!-- Details Modal -->
    <div id="modalOverlay" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-[5000]">
        <div class="bg-white rounded-lg w-[70vw] max-w-[95%] h-[90vh] flex flex-col shadow-2xl border-4 border-[#333] relative">
            <button onclick="closeModal('modalOverlay')" class="absolute top-2 right-2 text-2xl text-gray-500 hover:text-black z-10">✕</button>
            <div id="modalContent" class="flex-1 overflow-y-auto bg-[#f0f2f5]"></div>
        </div>
    </div>

    <!-- Guide Modal -->
    <div id="guideModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-[5000]">
        <div class="bg-white rounded-lg w-[700px] max-w-[95%] h-[85vh] flex flex-col shadow-xl">
            <div class="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                <span class="font-bold text-lg">🗺️ 生成旅行条件 (仅选中项目)</span>
                <button onclick="closeModal('guideModal')" class="text-2xl text-gray-500 hover:text-black">✕</button>
            </div>
            <div class="p-4 bg-gray-100 grid grid-cols-2 gap-4 text-sm">
                <div><label class="block font-bold mb-1">📍 出发地</label><input id="g_city" class="w-full border p-2 rounded" placeholder="北京"></div>
                <div><label class="block font-bold mb-1">📅 出发日期</label><input type="date" id="g_start" class="w-full border p-2 rounded"></div>
                <div><label class="block font-bold mb-1">🏁 返程日期</label><input type="date" id="g_end" class="w-full border p-2 rounded"></div>
                <div><label class="block font-bold mb-1">✈️ 长途交通</label><select id="g_long" class="w-full border p-2 rounded"><option>智能混排</option><option>飞机</option></select></div>
                <div class="col-span-2"><button onclick="generateGuide()" class="bg-green-600 text-white w-full py-2 rounded font-bold">✨ 生成方案</button></div>
            </div>
            <div id="guideContent" class="flex-1 overflow-y-auto p-6 bg-gray-50"></div>
            <div class="p-4 border-t text-right"><button onclick="downloadPDF('guideContent', '考察行程方案.pdf')" class="bg-red-500 text-white px-4 py-2 rounded">⬇️ 导出 PDF</button></div>
        </div>
    </div>

    <!-- PDF Export Modal -->
    <div id="exportModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-[5000]">
        <div class="bg-white rounded-lg w-[800px] h-[90vh] flex flex-col shadow-xl">
            <div class="p-4 border-b flex justify-between items-center bg-gray-50">
                <span class="font-bold text-lg">📄 导出项目清单 (仅选中项目)</span>
                <button onclick="closeModal('exportModal')" class="text-2xl text-gray-500 hover:text-black">✕</button>
            </div>
            <div class="p-4 bg-gray-100 flex gap-4 items-center">
               <input id="pdfTitle" value="项目清单" class="border p-2 rounded flex-1">
               <button onclick="downloadPDF('exportContent', document.getElementById('pdfTitle').value+'.pdf')" class="bg-red-600 text-white px-4 py-2 rounded font-bold">⬇️ 下载</button>
            </div>
            <div class="flex-1 overflow-y-auto p-8 bg-gray-50">
                <div id="exportContent" class="bg-white p-8 shadow min-h-full"></div>
            </div>
        </div>
    </div>

    <script>
        const TYPES = ${JSON.stringify(projectTypes)};
        const PERMISSION = "${permission}";
        const CITIES = ${JSON.stringify(cities)};
        const LABELS = ${JSON.stringify(labels)};
        
        // Mutable State for the HTML session
        let DATA = ${JSON.stringify(safeData)};
        let selectedIds = new Set(DATA.map(p => p.id));
        let filteredData = [...DATA];
        
        // Init Filters
        const citySel = document.getElementById('filterCity');
        CITIES.forEach(c => citySel.add(new Option(c, c)));
        const typeSel = document.getElementById('filterType');
        TYPES.forEach(t => typeSel.add(new Option(t.label, t.key)));
        const labelSel = document.getElementById('filterLabel');
        LABELS.forEach(l => labelSel.add(new Option(l, l)));

        // Map Init
        const map = L.map('map').setView([30.655, 104.08], 6);
        L.tileLayer('https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
            attribution: 'Map data &copy; Gaode', minZoom: 3, maxZoom: 18
        }).addTo(map);

        const markers = {};
        let activeMarkerId = null;

        // --- Resizer Logic ---
        const resizer = document.getElementById('resizer');
        const sidebar = document.getElementById('sidebarPanel');
        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const percentage = (e.clientX / window.innerWidth) * 100;
            if (percentage > 15 && percentage < 70) {
                sidebar.style.width = percentage + '%';
                map.invalidateSize();
            }
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
            document.body.style.cursor = 'default';
        });

        // --- Map Search Logic ---
        async function searchMap() {
            const query = document.getElementById('mapSearchInput').value;
            if(!query || !query.trim()) return;
            try {
                const response = await fetch(\`https://nominatim.openstreetmap.org/search?format=json&q=\${encodeURIComponent(query)}\`);
                const data = await response.json();
                if(data && data.length > 0) {
                    const { lat, lon } = data[0];
                    map.setView([parseFloat(lat), parseFloat(lon)], 13);
                } else {
                    alert("未找到地点，请尝试其他关键词");
                }
            } catch(e) {
                alert("搜索出错，请检查网络");
            }
        }

        const createIcon = (color, isActive) => {
            const scale = isActive ? 1.2 : 1; 
            const borderColor = isActive ? '#00FF00' : 'white';
            const shadow = isActive ? '0 0 10px yellow' : '0 0 5px black';
            return L.divIcon({
                className: \`custom-icon \${isActive ? 'active-marker' : ''}\`,
                html: \`<div style="background:\${color};width:22px;height:22px;border-radius:50%;border:2px solid \${borderColor};box-shadow:\${shadow};transform:scale(\${scale});"></div>\`,
                iconSize: [22, 22],
                iconAnchor: [11, 11],
            });
        };

        function applyFilters() {
            const search = document.getElementById('searchInput').value.toLowerCase();
            const city = document.getElementById('filterCity').value;
            const type = document.getElementById('filterType').value;
            const label = document.getElementById('filterLabel').value;

            filteredData = DATA.filter(p => {
                const matchSearch = p.name.toLowerCase().includes(search) || p.city.includes(search) || p.label.includes(search);
                const matchCity = city === 'all' || p.city === city;
                const matchType = type === 'all' || p.type === type;
                const matchLabel = label === 'all' || p.label === label;
                return matchSearch && matchCity && matchType && matchLabel;
            });
            render();
        }

        function toggleSelect(id) {
            if(selectedIds.has(id)) selectedIds.delete(id);
            else selectedIds.add(id);
            render();
        }

        function toggleCitySelect(city) {
            const cityProjects = filteredData.filter(p => p.city === city);
            const allSelected = cityProjects.every(p => selectedIds.has(p.id));
            
            cityProjects.forEach(p => {
                if(allSelected) selectedIds.delete(p.id);
                else selectedIds.add(p.id);
            });
            render();
        }

        function deleteItem(id) {
            if(!confirm("确定删除此项目吗？")) return;
            DATA = DATA.filter(p => p.id !== id);
            selectedIds.delete(id);
            applyFilters();
        }

        function deleteCity(city) {
            if(!confirm("确定删除城市 ["+city+"] 及该城市下所有项目吗？")) return;
            DATA = DATA.filter(p => p.city !== city);
            applyFilters();
        }

        function renameItem(id) {
            const p = DATA.find(x => x.id === id);
            if (!p) return;
            const newName = prompt("重命名项目:", p.name);
            if(newName && newName.trim()) {
                p.name = newName.trim();
                render();
            }
        }

        function focusCity(city) {
            const cityProjects = filteredData.filter(p => p.city === city);
            if(cityProjects.length > 0) {
                const latLngs = cityProjects.map(p => [p.lat, p.lng]);
                const bounds = L.latLngBounds(latLngs);
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        }

        function addNewCity() {
            const city = prompt("请输入新城市名称:");
            if(city && city.trim()) {
                const newP = {
                    id: 'new_'+Date.now(),
                    name: '新建项目',
                    city: city.trim(),
                    type: 'Commercial',
                    label: '待定',
                    lat: map.getCenter().lat,
                    lng: map.getCenter().lng,
                    publicDescription: '',
                    images: []
                };
                DATA.push(newP);
                selectedIds.add(newP.id);
                applyFilters();
                // Update dropdown
                const opt = new Option(city.trim(), city.trim());
                document.getElementById('filterCity').add(opt);
            }
        }

        function addProject(city) {
            const name = prompt("请输入项目名称:");
            if(name && name.trim()) {
                const newP = {
                    id: 'new_'+Date.now(),
                    name: name.trim(),
                    city: city,
                    type: 'Commercial',
                    label: '待定',
                    lat: map.getCenter().lat,
                    lng: map.getCenter().lng,
                    publicDescription: '',
                    images: []
                };
                DATA.push(newP);
                selectedIds.add(newP.id);
                applyFilters();
            }
        }

        function render() {
            const sidebar = document.getElementById('sidebarContent');
            const groups = {};
            filteredData.forEach(p => {
                if(!groups[p.city]) groups[p.city] = [];
                groups[p.city].push(p);
            });

            // Markers
            Object.values(markers).forEach(m => map.removeLayer(m));
            
            let html = '';
            for(const [city, list] of Object.entries(groups)) {
                const allSelected = list.every(p => selectedIds.has(p.id));
                html += \`
                    <div class="border-b bg-white">
                        <div class="p-3 bg-gray-100 font-bold sticky top-0 flex justify-between items-center hover:bg-gray-200 cursor-pointer">
                            <div class="flex items-center gap-2" onclick="event.stopPropagation(); toggleCitySelect('\${city}')">
                                <input type="checkbox" \${allSelected ? 'checked' : ''} class="w-4 h-4 cursor-pointer">
                                <span onclick="event.stopPropagation(); focusCity('\${city}')" title="点击定位城市">🏙️ \${city} (\${list.length})</span>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="addProject('\${city}')" class="text-blue-500 hover:text-blue-700" title="添加项目"><i class="fa-solid fa-plus"></i></button>
                                <button onclick="deleteCity('\${city}')" class="text-gray-400 hover:text-red-500" title="删除城市"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                \`;
                list.forEach(p => {
                    const typeDef = TYPES.find(t => t.key === p.type);
                    const color = typeDef ? typeDef.color : '#3498db';
                    const isActive = p.id === activeMarkerId;
                    
                    // Only render marker if it matches filter AND is selected.
                    if(selectedIds.has(p.id)) {
                        const marker = L.marker([p.lat, p.lng], {
                            icon: createIcon(color, isActive),
                            zIndexOffset: isActive ? 1000 : 0,
                            draggable: true
                        }).addTo(map);
                        
                        marker.on('dragend', (e) => {
                            p.lat = e.target.getLatLng().lat;
                            p.lng = e.target.getLatLng().lng;
                        });
                        
                        const firstImage = p.images && p.images.length > 0 ? p.images[0].src : '';
                        const popupContent = \`
                            <div style="text-align:center; padding:10px; min-width:220px;">
                            \${firstImage ? \`<div style="width:100%;height:100px;background-image:url('\${firstImage}');background-size:cover;background-position:center;border-radius:4px;margin-bottom:8px;"></div>\` : ''}
                            <h3 style="font-weight:bold; margin-bottom:4px; font-size: 16px;">\${p.name}</h3>
                            <div style="font-size:12px;color:#666;">\${p.city} | \${typeDef?.label || p.type}</div>
                            <button onclick="openDetail('\${p.id}')" style="width:100%; background:#3498db; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; margin-top:5px; font-weight:bold;">📝 查看详情</button>
                            <div style="border-top:1px solid #eee; padding-top:5px; margin-top:5px;">
                                <div style="font-size:12px; font-weight:bold; color:#27ae60; margin-bottom:5px;">🚗 导航前往</div>
                                <div style="display:flex; gap:5px; justify-content:center;">
                                    <a href="https://uri.amap.com/marker?position=\${p.lng},\${p.lat}&name=\${encodeURIComponent(p.name)}" target="_blank" style="font-size:12px; color:#333; text-decoration:none; background:#f0f0f0; padding:4px 8px; border-radius:3px;">高德</a>
                                    <a href="http://api.map.baidu.com/marker?location=\${p.lat},\${p.lng}&title=\${encodeURIComponent(p.name)}&content=\${encodeURIComponent(p.name)}&output=html" target="_blank" style="font-size:12px; color:#333; text-decoration:none; background:#f0f0f0; padding:4px 8px; border-radius:3px;">百度</a>
                                </div>
                            </div>
                            </div>
                        \`;
                        marker.bindPopup(popupContent);
                        marker.on('click', () => {
                            activeMarkerId = p.id;
                            render();
                            document.getElementById('row-'+p.id)?.scrollIntoView({block:'center', behavior:'smooth'});
                        });
                        if(isActive) marker.openPopup();
                        markers[p.id] = marker;
                    }

                    html += \`
                        <div id="row-\${p.id}" class="p-3 border-b hover:bg-gray-50 cursor-pointer flex items-center gap-2 \${isActive ? 'bg-blue-50 border-r-4 border-blue-500' : ''}" onclick="focusProject('\${p.id}')">
                            <input type="checkbox" \${selectedIds.has(p.id) ? 'checked' : ''} onclick="event.stopPropagation(); toggleSelect('\${p.id}')" class="cursor-pointer">
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <div class="font-bold text-sm" ondblclick="event.stopPropagation(); renameItem('\${p.id}')" title="双击重命名">\${p.name}</div>
                                    <button onclick="event.stopPropagation(); renameItem('\${p.id}')" class="text-xs text-gray-300 hover:text-blue-500"><i class="fa-solid fa-pencil"></i></button>
                                </div>
                                <div class="text-xs text-gray-500 mt-1">
                                    <span class="border px-1 rounded" style="background-color: \${typeDef?.bgColorClass ? '' : '#eee'}">\${typeDef?.label || p.type}</span> 
                                    <span class="bg-gray-100 px-1 rounded">\${p.label}</span>
                                </div>
                            </div>
                            <button onclick="event.stopPropagation(); deleteItem('\${p.id}')" class="text-gray-300 hover:text-red-500"><i class="fa-solid fa-times"></i></button>
                        </div>
                    \`;
                });
                html += '</div>';
            }
            if(Object.keys(groups).length === 0) html = '<div class="p-4 text-center text-gray-400">无数据</div>';
            sidebar.innerHTML = html;
        }

        window.focusProject = (id) => {
            const p = DATA.find(x => x.id === id);
            if(p && selectedIds.has(id)) {
                map.setView([p.lat, p.lng], 16);
                activeMarkerId = id;
                render();
                markers[id]?.openPopup();
            }
        };

        window.openDetail = (id) => {
            const p = DATA.find(x => x.id === id);
            if(!p) return;
            const typeDef = TYPES.find(t => t.key === p.type);
            const content = document.getElementById('modalContent');
            
            let imgsHtml = (p.images || []).map(img => \`
                <div class="border p-2 rounded bg-white">
                    <img src="\${img.src}" class="w-full h-48 object-cover rounded mb-2">
                    <div class="text-sm bg-gray-50 p-1">\${img.caption || '无描述'}</div>
                </div>
            \`).join('');

            let internalHtml = '';
            if (PERMISSION === 'admin' && (p.internalDescription || (p.internalImages && p.internalImages.length))) {
                const intImgs = (p.internalImages || []).map(img => \`
                    <div class="border p-2 rounded bg-white">
                        <img src="\${img.src}" class="w-full h-48 object-cover rounded mb-2">
                        <div class="text-sm bg-gray-50 p-1">\${img.caption || '无描述'}</div>
                    </div>
                \`).join('');
                const attachments = (p.attachments || []).map(att => \`
                     <div class="flex justify-between items-center bg-white p-2 rounded border border-orange-100 text-sm">
                        <span class="text-blue-600 truncate">\${att.name}</span>
                        <span class="text-xs text-gray-400">(\${(att.size/1024).toFixed(1)} KB)</span>
                     </div>
                \`).join('');
                internalHtml = \`<div class="bg-orange-50 p-3 border-y border-orange-200 font-bold text-orange-800 text-sm mt-4">🔒 内部资料</div><div class="p-4 bg-orange-50 space-y-4"><div class="whitespace-pre-wrap text-sm">\${p.internalDescription || '无内部笔记'}</div><div class="grid grid-cols-2 gap-4">\${intImgs}</div><div class="border-t border-orange-200 pt-2"><div class="font-bold text-xs text-orange-400 mb-2">附件:</div><div class="space-y-1">\${attachments || '<div class="text-gray-400 italic text-xs">暂无</div>'}</div></div></div>\`;
            }

            content.innerHTML = \`<div class="p-4 bg-gray-50 border-b"><h2 class="text-xl font-bold">\${p.name}</h2><div class="flex gap-2 mt-2 text-sm"><span class="px-2 py-1 rounded bg-blue-100 text-blue-800">\${p.city}</span><span class="px-2 py-1 rounded bg-gray-100">\${typeDef?.label || p.type}</span><span class="px-2 py-1 rounded bg-gray-100">\${p.label}</span></div></div><div class="p-4 bg-white space-y-4"><div class="font-bold text-gray-600 border-b pb-2">📷 公共项目概况</div><div class="whitespace-pre-wrap text-sm text-gray-700">\${p.publicDescription || '暂无描述'}</div><div class="grid grid-cols-2 gap-4">\${imgsHtml}</div></div>\${internalHtml}\`;
            document.getElementById('modalOverlay').classList.remove('hidden');
            document.getElementById('modalOverlay').classList.add('flex');
        };

        window.openGuideModal = () => {
            document.getElementById('guideModal').classList.remove('hidden');
            document.getElementById('guideModal').classList.add('flex');
        };

        window.generateGuide = () => {
            // STRICTLY use only selected items for calculation
            const s = document.getElementById('g_start').value;
            const e = document.getElementById('g_end').value;
            const city = document.getElementById('g_city').value;
            
            let days = 3;
            if(s && e) { days = Math.ceil(Math.abs(new Date(e) - new Date(s)) / (86400000)) + 1; }
            
            // STRICT FILTER: Only projects whose IDs are in the selectedIds set
            const selectedProjects = DATA.filter(p => selectedIds.has(p.id));
            
            if(selectedProjects.length === 0) {
                document.getElementById('guideContent').innerHTML = '<div class="text-center text-red-500 font-bold p-4">❌ 错误：请先在左侧列表勾选需要考察的项目，再生成方案。</div>';
                return;
            }

            let html = \`<div class="mb-4 text-center font-bold text-lg">考察方案: \${city || '未指定'} (\${days}天)</div>\`;
            
            const groups = {};
            selectedProjects.forEach(p => { if(!groups[p.city]) groups[p.city] = []; groups[p.city].push(p); });
            
            Object.entries(groups).forEach(([c, list]) => {
                html += \`<div class="mb-4"><div class="font-bold text-blue-800 border-b mb-2">\${c}</div><ul class="list-disc pl-5 text-sm space-y-1">\`;
                list.forEach(p => html += \`<li>\${p.name} <span class="text-gray-400">(\${p.type})</span></li>\`);
                html += \`</ul></div>\`;
            });
            document.getElementById('guideContent').innerHTML = html;
        };

        window.openExportModal = () => {
            const content = document.getElementById('exportContent');
            const title = document.getElementById('pdfTitle').value;
            content.innerHTML = \`<div class="text-2xl font-bold text-center mb-6">\${title}</div>\`;
            
            const selectedProjects = DATA.filter(p => selectedIds.has(p.id));
            if(selectedProjects.length === 0) {
                content.innerHTML += '<div class="text-center text-red-500 font-bold p-4">❌ 错误：请先在左侧列表勾选需要导出的项目。</div>';
                document.getElementById('exportModal').classList.remove('hidden');
                document.getElementById('exportModal').classList.add('flex');
                return;
            }

            const groups = {};
            selectedProjects.forEach(p => { if(!groups[p.city]) groups[p.city] = []; groups[p.city].push(p); });

            Object.entries(groups).forEach(([city, list]) => {
                let section = \`<div class="mb-6"><h2 class="text-xl font-bold border-b-2 border-blue-800 mb-4 pb-2 text-blue-800">\${city}</h2>\`;
                list.forEach((p, i) => {
                    const t = TYPES.find(x => x.key === p.type);
                    section += \`
                        <div class="mb-4 break-inside-avoid border-b pb-4">
                            <h3 class="font-bold text-lg">\${i+1}. \${p.name} <span class="text-xs font-normal border px-1 rounded">\${t?.label || p.type}</span></h3>
                            <div class="text-sm text-gray-500 mb-2">🏷️ \${p.label}</div>
                            <div class="bg-gray-50 p-2 text-sm rounded mb-2">\${p.publicDescription || '无描述'}</div>
                            \${(p.images||[]).length ? \`<div class="grid grid-cols-2 gap-2">\${(p.images).map(img=>\`<div class="text-center"><img src="\${img.src}" class="max-h-40 mx-auto"><div class="text-xs text-gray-500">\${img.caption}</div></div>\`).join('')}</div>\` : ''}
                            \${PERMISSION === 'admin' && p.internalDescription ? \`<div class="mt-2 p-2 bg-orange-50 border border-orange-200 rounded"><div class="text-xs font-bold text-orange-800">🔒 内部:</div><div class="text-sm">\${p.internalDescription}</div></div>\` : ''}
                        </div>
                    \`;
                });
                section += '</div>';
                content.innerHTML += section;
            });

            document.getElementById('exportModal').classList.remove('hidden');
            document.getElementById('exportModal').classList.add('flex');
        };

        window.downloadPDF = (id, filename) => {
            const element = document.getElementById(id);
            const opt = { margin: 10, filename: filename, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
            html2pdf().set(opt).from(element).save();
        };

        window.closeModal = (id) => {
             document.getElementById(id).classList.add('hidden');
             document.getElementById(id).classList.remove('flex');
        }

        ['searchInput', 'filterCity', 'filterType', 'filterLabel'].forEach(id => {
            document.getElementById(id).addEventListener('input', applyFilters);
        });
        
        applyFilters();
    </script>
</body>
</html>`;
};

// --- Helper Components ---

const LoginModal = ({ onClose, onLogin }: { onClose: () => void, onLogin: (u: User) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    try {
      const user = await db.login(username, password);
      onLogin(user);
      onClose();
    } catch (err) {
      setError('登录失败：用户名或密码错误');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[5000]">
      <div className="bg-white p-6 rounded-lg w-80 shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-gray-800">用户登录</h2>
        <input className="w-full border p-2 mb-2 rounded" placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} />
        <input className="w-full border p-2 mb-4 rounded" type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600">取消</button>
          <button onClick={handleLogin} className="px-4 py-2 bg-blue-600 text-white rounded">登录</button>
        </div>
        <div className="mt-4 text-xs text-gray-400">
          <p>测试账号:</p>
          <p>管理员: admin / 123</p>
          <p>分账号: editor1 / 123</p>
        </div>
      </div>
    </div>
  );
};

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

// Updated AddProjectModal with reordered fields and smart dropdowns
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

const AdminPanel = ({ onClose, projects }: { onClose: () => void, projects: Project[] }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'data'>('users');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  
  // Data Overview Filter
  const [filterUser, setFilterUser] = useState('all');

  useEffect(() => {
    setUsers(db.getUsers());
  }, []);

  const handleAddUser = async () => {
    if (!newUsername || !newName || !newPassword) {
        alert("请填写完整信息");
        return;
    }
    const newUser: User = {
      id: Date.now().toString(),
      username: newUsername,
      password: newPassword,
      name: newName,
      role: 'editor'
    };
    await db.addUser(newUser);
    setUsers(db.getUsers());
    setNewUsername('');
    setNewName('');
    setNewPassword('');
    alert(`用户已添加: ${newName}`);
  };

  const filteredProjects = useMemo(() => {
      if (filterUser === 'all') return projects;
      return projects.filter(p => p.createdBy === filterUser);
  }, [projects, filterUser]);

  const groupedData = useMemo(() => {
      const groups: Record<string, Project[]> = {};
      filteredProjects.forEach(p => {
          if(!groups[p.city]) groups[p.city] = [];
          groups[p.city].push(p);
      });
      return groups;
  }, [filteredProjects]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[5000]">
      <div className="bg-white rounded-lg w-[700px] h-[80vh] flex flex-col shadow-xl overflow-hidden">
        <div className="flex bg-gray-100 border-b">
            <button onClick={() => setActiveTab('users')} className={`flex-1 py-3 font-bold ${activeTab === 'users' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>👥 账号管理</button>
            <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 font-bold ${activeTab === 'data' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>📊 数据概览</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'users' && (
                <div>
                    <div className="mb-6 border-b pb-4">
                    <h3 className="font-bold text-sm text-gray-600 mb-2">添加分账号</h3>
                    <div className="flex gap-2 mb-2">
                        <input className="border p-2 rounded text-sm flex-1" placeholder="用户名" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
                        <input className="border p-2 rounded text-sm flex-1" placeholder="显示名称" value={newName} onChange={e => setNewName(e.target.value)} />
                        <input className="border p-2 rounded text-sm flex-1" placeholder="密码" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    </div>
                    <button onClick={handleAddUser} className="w-full bg-green-600 text-white py-2 rounded text-sm hover:bg-green-700">添加授权账号</button>
                    </div>
                    <ul className="space-y-2">
                    {users.map(u => (
                        <li key={u.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                        <div><span className="font-bold">{u.name}</span> <span className="text-gray-500 text-xs">({u.username})</span></div>
                        <div className="text-xs text-gray-400">{u.role === 'admin' ? '管理员' : '编辑'} | 密码: {u.password}</div>
                        </li>
                    ))}
                    </ul>
                </div>
            )}

            {activeTab === 'data' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4 bg-gray-100 p-2 rounded">
                        <span className="text-sm font-bold text-gray-600">筛选创建人:</span>
                        <select className="border p-1 rounded text-sm flex-1" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                            <option value="all">全部用户</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        <span className="text-xs text-gray-500">共 {filteredProjects.length} 个项目</span>
                    </div>

                    {Object.entries(groupedData).map(([city, list]: [string, Project[]]) => (
                        <div key={city} className="border rounded bg-gray-50">
                            <div className="p-2 bg-gray-200 font-bold flex justify-between">
                                <span>🏙️ {city}</span>
                                <span className="text-sm bg-white px-2 rounded">{list.length}</span>
                            </div>
                            <div className="p-2 space-y-1">
                                {list.map(p => (
                                    <div key={p.id} className="flex justify-between text-sm pl-4 border-l-2 border-gray-300 ml-2">
                                        <span>{p.name}</span>
                                        <span className="text-xs text-gray-500">by {p.createdByName} | {p.type}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {filteredProjects.length === 0 && <div className="text-center text-gray-400 py-4">无数据</div>}
                </div>
            )}
        </div>
        
        <div className="p-4 border-t text-right bg-white">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">关闭</button>
        </div>
      </div>
    </div>
  );
};

const GuideModal = ({ projects, onClose, projectTypes }: { projects: Project[], onClose: () => void, projectTypes: ProjectTypeDef[] }) => {
  const [startCity, setStartCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [longTransport, setLongTransport] = useState('智能混排 (远飞近铁)');
  const [shortTransport, setShortTransport] = useState('租车自驾');
  const [generatedHtml, setGeneratedHtml] = useState('');

  const generate = () => {
    let days = 3;
    if (startDate && returnDate) {
        const d1 = new Date(startDate);
        const d2 = new Date(returnDate);
        const diffTime = Math.abs(d2.getTime() - d1.getTime());
        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    const filtered = projects;
    const projectsPerDay = filtered.length / days;
    let verdictHTML = "";
    if(filtered.length === 0) {
        verdictHTML = `<div class="p-3 mb-4 rounded bg-gray-100 text-gray-700 border border-gray-200 text-center font-bold">没有符合条件的项目</div>`;
    } else if(projectsPerDay > 5) {
        verdictHTML = `<div class="p-3 mb-4 rounded bg-red-50 text-red-700 border border-red-200 text-center font-bold">⚠️ 警告：当前选中 ${filtered.length} 个项目，平均每天需考察 ${projectsPerDay.toFixed(1)} 个（建议每天3-5个），行程过于紧凑。</div>`;
    } else if (projectsPerDay < 2) {
        verdictHTML = `<div class="p-3 mb-4 rounded bg-green-50 text-green-700 border border-green-200 text-center font-bold">💡 提示：当前选中 ${filtered.length} 个项目，平均每天仅考察 ${projectsPerDay.toFixed(1)} 个，行程较为空闲。</div>`;
    } else {
        verdictHTML = `<div class="p-3 mb-4 rounded bg-blue-50 text-blue-700 border border-blue-200 text-center font-bold">✅ 行程适中：当前选中 ${filtered.length} 个项目，平均每天考察 ${projectsPerDay.toFixed(1)} 个。</div>`;
    }

    let html = verdictHTML;
    html += `<div class="mb-4 pb-2 border-b">
        <h3 class="font-bold text-gray-700 mb-2">📝 考察基础信息</h3>
        <div class="text-sm text-gray-600 space-y-1">
            <p><strong>📍 出发地：</strong> ${startCity || '未指定'}</p>
            <p><strong>📅 行程日期：</strong> ${startDate || '未指定'} 至 ${returnDate || '未指定'} (共 ${days} 天)</p>
            <p><strong>✈️ 长途交通：</strong> ${longTransport}</p>
            <p><strong>🚗 市内交通：</strong> ${shortTransport}</p>
        </div>
    </div>`;

    if (filtered.length > 0) {
        html += `<div class="mb-4">
            <h3 class="font-bold text-gray-700 mb-2">🏢 考察城市与项目清单</h3>`;
        
        const groups: {[key:string]: Project[]} = {};
        filtered.forEach(p => {
            if(!groups[p.city]) groups[p.city] = [];
            groups[p.city].push(p);
        });

        Object.entries(groups).forEach(([city, list], idx) => {
            const colors = ['text-blue-600 border-blue-600', 'text-orange-500 border-orange-500', 'text-purple-600 border-purple-600', 'text-teal-600 border-teal-600', 'text-red-600 border-red-600'];
            const colorClass = colors[idx % colors.length];
            
            html += `<div class="mb-4">
                <div class="text-lg font-bold mb-2 pl-2 border-l-4 ${colorClass}">${city}</div>
                <ul class="space-y-1">`;
            list.forEach(p => {
                const t = projectTypes.find(pt => pt.key === p.type);
                const typeLabel = t ? t.label : p.type;
                html += `<li class="bg-gray-50 p-2 rounded border text-sm font-medium">${p.name} <span class="text-xs text-gray-400">(${typeLabel})</span></li>`;
            });
            html += `</ul></div>`;
        });
        html += `</div>`;
    }
    
    setGeneratedHtml(html);
  };

  const exportPDF = () => {
     const element = document.getElementById('guide-result-content');
     if(!element) return;
     const opt = {
          margin: 10,
          filename: '考察旅行条件.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      // @ts-ignore
      if (typeof html2pdf !== 'undefined') html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[5000]">
      <div className="bg-white rounded-lg w-[700px] max-w-[95%] h-[85vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
            <span className="font-bold text-lg">🗺️ 生成旅行条件</span>
            <button onClick={onClose} className="text-2xl text-gray-500 hover:text-black">✕</button>
        </div>
        <div className="p-4 border-b bg-gray-100 grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-bold text-gray-600 mb-1">📍 出发地点</label><input className="w-full border p-2 rounded text-sm" value={startCity} onChange={e=>setStartCity(e.target.value)} placeholder="例如: 北京" /></div>
            <div><label className="block text-xs font-bold text-gray-600 mb-1">📅 出发日期</label><input type="date" className="w-full border p-2 rounded text-sm" value={startDate} onChange={e=>setStartDate(e.target.value)} /></div>
            <div><label className="block text-xs font-bold text-gray-600 mb-1">🏁 返程日期</label><input type="date" className="w-full border p-2 rounded text-sm" value={returnDate} onChange={e=>setReturnDate(e.target.value)} /></div>
            <div><label className="block text-xs font-bold text-gray-600 mb-1">✈️ 长途交通</label>
                <select className="w-full border p-2 rounded text-sm" value={longTransport} onChange={e=>setLongTransport(e.target.value)}>
                    <option>智能混排 (远飞近铁)</option><option>飞机</option><option>高铁</option><option>自驾</option>
                </select>
            </div>
            <div className="col-span-2"><label className="block text-xs font-bold text-gray-600 mb-1">🚗 市内交通</label>
                <select className="w-full border p-2 rounded text-sm" value={shortTransport} onChange={e=>setShortTransport(e.target.value)}>
                    <option>租车自驾</option><option>网约车/出租</option><option>公共交通</option>
                </select>
            </div>
            <div className="col-span-2 flex justify-end">
                <button onClick={generate} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 w-full">✨ 生成方案</button>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50" id="guide-result-wrapper">
             {generatedHtml ? (
                 <div id="guide-result-content" dangerouslySetInnerHTML={{__html: generatedHtml}} className="bg-white p-6 shadow-sm border" />
             ) : (
                 <div className="h-full flex items-center justify-center text-gray-400">请填写条件并点击生成</div>
             )}
        </div>
        {generatedHtml && (
            <div className="p-4 border-t flex justify-end gap-2 bg-white rounded-b-lg">
                <button onClick={exportPDF} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">📄 导出 PDF</button>
            </div>
        )}
      </div>
    </div>
  );
};

// -- Image Upload Flow Modals --

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

// Reuse logic for both public and internal sections
const ImageGrid = ({ 
    images, 
    canEdit, 
    onUpdate, 
    onAddClick,
    prefix 
}: { 
    images: ImageItem[], 
    canEdit: boolean, 
    onUpdate: (imgs: ImageItem[]) => void, 
    onAddClick: () => void, 
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
        <div className="space-y-4">
            {images.map((img, idx) => (
               <div key={`${prefix}-${idx}`} className="border p-2 rounded bg-white shadow-sm">
                 <div className="h-48 bg-gray-100 flex items-center justify-center overflow-hidden rounded mb-2 relative group">
                   <img src={img.src} alt="" className="w-full h-full object-cover" />
                   {canEdit && (
                     <button 
                        onClick={() => onUpdate(images.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                     >✕</button>
                   )}
                 </div>
                 <div className="mb-2">
                     <input 
                        className="w-full border rounded p-2 text-sm bg-gray-50 mb-1" 
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
                 className="border-2 border-dashed border-gray-300 rounded-lg h-24 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-colors text-gray-400"
               >
                 <i className="fa-solid fa-plus text-2xl mb-1"></i>
                 <span className="text-xs">添加图片</span>
               </div>
            )}
        </div>
    );
};


const ProjectDetailModal = ({ 
  project, 
  currentUser,
  labelName,
  projectTypes,
  availableCities,
  availableLabels,
  onClose, 
  onSave 
}: { 
  project: Project, 
  currentUser: User | null,
  labelName: string,
  projectTypes: ProjectTypeDef[],
  availableCities: string[],
  availableLabels: string[],
  onClose: () => void, 
  onSave: (p: Project) => void 
}) => {
  const [saving, setSaving] = useState(false);
  
  // Public Fields
  const [editName, setEditName] = useState(project.name);
  const [editCity, setEditCity] = useState(project.city);
  const [editType, setEditType] = useState(project.type);
  const [editLabel, setEditLabel] = useState(project.label);
  const [publicDesc, setPublicDesc] = useState(project.publicDescription || '');
  const [publicImages, setPublicImages] = useState<ImageItem[]>(project.images);

  // Internal Fields
  const [internalDesc, setInternalDesc] = useState(project.internalDescription || '');
  const [internalImages, setInternalImages] = useState<ImageItem[]>(project.internalImages || []);
  const [attachments, setAttachments] = useState<Attachment[]>(project.attachments || []);

  // Upload Logic State
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showCompressModal, setShowCompressModal] = useState(false);
  const [targetSection, setTargetSection] = useState<'public' | 'internal'>('public');
  const [pendingSource, setPendingSource] = useState<'camera' | 'album' | null>(null);
  const [useCompression, setUseCompression] = useState(true);
  
  // File inputs Refs
  const albumInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const attachmentRef = useRef<HTMLInputElement>(null);

  // Permissions
  const isAdmin = currentUser?.role === 'admin';
  const isCreator = currentUser?.id === project.createdBy;
  const isEditor = currentUser?.role === 'editor';
  
  // Basic edit rights: Admin can edit all. Creator can edit own.
  const canEditPublic = isAdmin || isCreator;
  
  // Internal Info Privacy:
  // Admin sees/edits all internal info.
  // Creator sees/edits their own internal info.
  // Other Editors: CANNOT SEE internal info of others.
  // Guest: CANNOT SEE any internal info.
  const canSeeInternal = isAdmin || isCreator; 
  const canEditInternal = isAdmin || isCreator;

  // 1. Source Selected
  const handleSourceSelect = (source: 'camera' | 'album') => {
      setPendingSource(source);
      setShowSourceModal(false);
      setShowCompressModal(true);
  };

  // 2. Compression Selected -> Trigger Input
  const handleCompressConfirm = (compress: boolean) => {
      setUseCompression(compress);
      setShowCompressModal(false);
      // Trigger the correct input
      if (pendingSource === 'camera') {
          cameraInputRef.current?.click();
      } else {
          albumInputRef.current?.click();
      }
  };

  const compressImage = (src: string): Promise<string> => {
      return new Promise((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const MAX = 1000;
              let w = img.width;
              let h = img.height;
              if (w > MAX || h > MAX) {
                  if (w > h) { h *= MAX / w; w = MAX; }
                  else { w *= MAX / h; h = MAX; }
              }
              canvas.width = w;
              canvas.height = h;
              ctx?.drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
          img.onerror = () => resolve(src);
      });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        let result = evt.target?.result as string;
        if (useCompression) {
            result = await compressImage(result);
        }
        
        const newItem: ImageItem = { src: result, caption: '', audios: [] };
        if (targetSection === 'public') {
            setPublicImages(prev => [...prev, newItem]);
        } else {
            setInternalImages(prev => [...prev, newItem]);
        }
      };
      reader.readAsDataURL(file);
    }
    if(e.target) e.target.value = '';
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Convert to base64 for mock storage
      const reader = new FileReader();
      reader.onload = (evt) => {
          const newItem: Attachment = {
              name: file.name,
              url: evt.target?.result as string,
              size: file.size
          };
          setAttachments(prev => [...prev, newItem]);
      };
      reader.readAsDataURL(file);
      if(e.target) e.target.value = '';
  };

  const handleClose = async () => {
      // Auto save if user has edit rights
      if (canEditPublic) {
          setSaving(true);
          const updated: Project = { 
              ...project, 
              name: editName, 
              city: editCity, 
              type: editType, 
              label: editLabel,
              publicDescription: publicDesc,
              images: publicImages,
              // Only update internal if we have rights to see/edit it, otherwise keep original
              internalDescription: canEditInternal ? internalDesc : project.internalDescription,
              internalImages: canEditInternal ? internalImages : project.internalImages,
              attachments: canEditInternal ? attachments : project.attachments
          };
          await db.saveProject(updated);
          onSave(updated);
          setSaving(false);
      }
      onClose();
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (e.target.value === '__NEW__') {
          const newCity = prompt("请输入新城市名称:");
          if (newCity && newCity.trim()) {
              setEditCity(newCity.trim());
          }
      } else {
          setEditCity(e.target.value);
      }
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (e.target.value === '__NEW__') {
          const newLabel = prompt("请输入新项目类别:");
          if (newLabel && newLabel.trim()) {
              setEditLabel(newLabel.trim());
          }
      } else {
          setEditLabel(e.target.value);
      }
  };

  const currentType = projectTypes.find(t => t.key === project.type);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[5000]">
      {/* Resized modal to 70vw */}
      <div className="bg-white rounded-lg w-[70vw] max-w-[95%] h-[90vh] flex flex-col shadow-2xl border-4 border-[#333]">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <span className="font-bold text-lg flex-1 mr-4 break-words">
              {canEditPublic ? (
                  <input className="w-full border-b border-gray-400 bg-transparent focus:outline-none" value={editName} onChange={e=>setEditName(e.target.value)} />
              ) : project.name}
          </span>
          <div className="flex items-center gap-4 shrink-0">
             {saving && <span className="text-green-600 text-xs animate-pulse">自动保存中...</span>}
             <button onClick={handleClose} className="text-2xl text-gray-500 hover:text-black">✕</button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto bg-[#f0f2f5] p-0 flex flex-col">
          {/* Metadata Section (Always Visible) */}
          <div className="bg-white p-4 border-b grid grid-cols-2 gap-4">
              <div>
                  <label className="block text-xs text-gray-500 font-bold mb-1">城市</label>
                  {canEditPublic ? (
                      <select className="w-full border rounded p-1 text-sm" value={availableCities.includes(editCity) ? editCity : '__CUSTOM__'} onChange={handleCityChange}>
                          {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                          {!availableCities.includes(editCity) && editCity && <option value="__CUSTOM__">{editCity}</option>}
                          <option value="__NEW__" className="font-bold text-blue-600">[ + 新增城市... ]</option>
                      </select>
                  ) : <span className="text-sm">{project.city}</span>}
              </div>
              <div>
                  <label className="block text-xs text-gray-500 font-bold mb-1">类型</label>
                   {canEditPublic ? (
                       <select className="w-full border rounded p-1 text-sm" value={editType} onChange={e=>setEditType(e.target.value as any)}>
                          {projectTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                       </select>
                   ) : <span className={`text-sm px-2 rounded ${currentType?.bgColorClass || 'bg-gray-100'}`}>{currentType?.label || project.type}</span>}
              </div>
              <div className="col-span-2">
                  <label className="block text-xs text-gray-500 font-bold mb-1">项目类别</label>
                  {canEditPublic ? (
                      <select className="w-full border rounded p-1 text-sm" value={availableLabels.includes(editLabel) ? editLabel : '__CUSTOM__'} onChange={handleLabelChange}>
                          {availableLabels.map(l => <option key={l} value={l}>{l}</option>)}
                          {!availableLabels.includes(editLabel) && editLabel && <option value="__CUSTOM__">{editLabel}</option>}
                          <option value="__NEW__" className="font-bold text-blue-600">[ + 新增类别... ]</option>
                      </select>
                  ) : <span className="text-sm bg-blue-50 px-2 rounded text-blue-800">{project.label}</span>}
              </div>
          </div>

          {/* PUBLIC SECTION */}
          <div className="bg-white p-3 border-b font-bold text-gray-600 text-sm flex justify-between items-center mt-2">
              <span>📷 公共项目概况</span>
          </div>
          <div className="p-4 bg-white space-y-4 border-b">
             <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">项目描述 (公共)</label>
                <textarea 
                    className="w-full h-24 p-2 border rounded resize-none text-sm bg-gray-50"
                    placeholder="在此输入公共项目描述..."
                    value={publicDesc}
                    readOnly={!canEditPublic}
                    onChange={e => setPublicDesc(e.target.value)}
                />
             </div>
             
             <ImageGrid 
                images={publicImages} 
                canEdit={canEditPublic} 
                onUpdate={setPublicImages} 
                onAddClick={() => { setTargetSection('public'); setShowSourceModal(true); }}
                prefix="pub"
             />
          </div>

          {/* INTERNAL SECTION (Restricted) */}
          {canSeeInternal && (
              <>
                  <div className="bg-orange-50 p-3 border-y border-orange-200 font-bold text-orange-800 text-sm flex justify-between items-center mt-2">
                      <span>🔒 内部项目信息 (仅管理员/作者可见)</span>
                  </div>
                  <div className="p-4 bg-orange-50 space-y-4 mb-8">
                      <div>
                        <label className="block text-xs font-bold text-orange-400 mb-1">内部笔记</label>
                        <textarea 
                            className="w-full h-24 p-2 border border-orange-200 rounded resize-none text-sm bg-white focus:ring-2 focus:ring-orange-300 outline-none"
                            placeholder="在此输入内部私密笔记..."
                            value={internalDesc}
                            readOnly={!canEditInternal}
                            onChange={e => setInternalDesc(e.target.value)}
                        />
                     </div>
                     
                     <ImageGrid 
                        images={internalImages} 
                        canEdit={canEditInternal} 
                        onUpdate={setInternalImages} 
                        onAddClick={() => { setTargetSection('internal'); setShowSourceModal(true); }}
                        prefix="int"
                     />
                     
                     <div className="border-t border-orange-200 pt-4 mt-4">
                        <label className="block text-xs font-bold text-orange-400 mb-2">附件列表</label>
                        <div className="space-y-2 mb-2">
                            {attachments.map((att, i) => (
                                <div key={i} className="flex justify-between items-center bg-white p-2 rounded border border-orange-100 text-sm">
                                    <a href={att.url} download={att.name} className="text-blue-600 hover:underline truncate max-w-[200px]">{att.name}</a>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">{(att.size / 1024).toFixed(1)} KB</span>
                                        {canEditInternal && (
                                            <button onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} className="text-red-500">✕</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {attachments.length === 0 && <div className="text-xs text-gray-400 italic">暂无附件</div>}
                        </div>
                        {canEditInternal && (
                            <button onClick={() => attachmentRef.current?.click()} className="text-xs bg-orange-200 text-orange-800 px-3 py-1 rounded hover:bg-orange-300">
                                📎 上传附件
                            </button>
                        )}
                     </div>
                  </div>
              </>
          )}

        </div>
      </div>
      
      {showSourceModal && <SourceModal onClose={() => setShowSourceModal(false)} onSelect={handleSourceSelect} />}
      {showCompressModal && <CompressModal onClose={() => setShowCompressModal(false)} onConfirm={handleCompressConfirm} />}
      
      {/* Hidden inputs for file upload */}
      <input type="file" ref={albumInputRef} accept="image/*" className="hidden" onChange={handleFileChange} />
      <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
      <input type="file" ref={attachmentRef} className="hidden" onChange={handleAttachmentChange} />
    </div>
  );
};

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

// Modal for Exporting HTML with permissions
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

// Map Search Component
const MapSearch = ({ map }: { map: L.Map | null }) => {
    const [query, setQuery] = useState('');
    
    const handleSearch = async (e?: React.FormEvent) => {
        if(e) e.preventDefault();
        if(!query.trim() || !map) return;
        
        try {
            // Using OpenStreetMap Nominatim for geocoding
            // Note: In strict China network environments without VPN, accessing OSM APIs might be slow.
            // A production app would proxy this or use Baidu/Gaode Web API with proper keys.
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

// Component for Export Dropdown with Delay
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

// --- Main App Component ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeDef[]>([]);
  const [labelFieldName] = useState('项目类别'); 

  const [showLogin, setShowLogin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showExportFilter, setShowExportFilter] = useState(false);
  const [showExportHTML, setShowExportHTML] = useState(false);

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(33.33);
  
  // New Sidebar Search
  const [sidebarSearch, setSidebarSearch] = useState('');
  
  // Filters (Restored)
  const [filterCity, setFilterCity] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterLabel, setFilterLabel] = useState('all');
  const [filterCreator, setFilterCreator] = useState('all');

  // Dynamic Lists for Dropdowns
  const uniqueCities = useMemo(() => Array.from(new Set(projects.map(p => p.city))), [projects]);
  const uniqueLabels = useMemo(() => Array.from(new Set(projects.map(p => p.label || '无标签'))), [projects]);
  
  // Selection Mode State (Set of IDs)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showAddCityModal, setShowAddCityModal] = useState(false);
  const [addProjectCity, setAddProjectCity] = useState<string | null>(null);

  const [draggedProject, setDraggedProject] = useState<Project | null>(null);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  useEffect(() => {
    const user = db.getCurrentUser();
    setCurrentUser(user);
    loadProjects();
    loadTypes();
    setUsers(db.getUsers());
  }, []);

  const loadProjects = async () => {
    const data = await db.getProjects();
    setProjects(data);
    // Initialize selection: all projects selected by default
    setSelectedIds(new Set(data.map(p => p.id)));
  };

  const loadTypes = async () => {
      const types = await db.getProjectTypes();
      setProjectTypes(types);
  };

  // Expose function for updating a project from popup to global window scope so Leaflet can call it
  useEffect(() => {
      // @ts-ignore
      window.updateProjectFromPopup = async (id: string, field: string, value: string) => {
          const project = projects.find(p => p.id === id);
          if (project) {
              const updated = { ...project, [field]: value };
              setProjects(prev => prev.map(p => p.id === id ? updated : p));
              await db.saveProject(updated);
          }
      };

      // Handle dropdown logic for Map Popup
      // @ts-ignore
      window.handlePopupChange = (element: HTMLSelectElement, id: string, field: string, oldValue: string) => {
          if (element.value === '__NEW__') {
              const promptText = field === 'city' ? "请输入新城市名称:" : "请输入新项目类别:";
              const newValue = prompt(promptText);
              if (newValue && newValue.trim()) {
                  // @ts-ignore
                  window.updateProjectFromPopup(id, field, newValue.trim());
              } else {
                  element.value = oldValue; // Revert if cancelled
              }
          } else {
              // @ts-ignore
              window.updateProjectFromPopup(id, field, element.value);
          }
      };

      // @ts-ignore
      window.openProjectDetail = (id: string) => {
          const p = projects.find(proj => proj.id === id);
          if(p) setActiveProject(p);
      };

      // @ts-ignore
      window.toggleProjectVisibility = async (id: string) => {
          const project = projects.find(p => p.id === id);
          if (project) {
              const updated = { ...project, isHidden: !project.isHidden };
              setProjects(prev => prev.map(p => p.id === id ? updated : p));
              await db.saveProject(updated);
              const marker = markersRef.current[id];
              if(marker) marker.closePopup();
          }
      };
  }, [projects]);

  // Combined Filtering Logic
  const filteredProjects = useMemo(() => {
      let result = projects;

      // 1. Text Search
      if (sidebarSearch.trim()) {
          const term = sidebarSearch.toLowerCase();
          result = result.filter(p => {
              const typeDef = projectTypes.find(t => t.key === p.type);
              const typeName = typeDef ? typeDef.label : p.type;
              return (
                  p.name.toLowerCase().includes(term) || 
                  p.label.toLowerCase().includes(term) || 
                  typeName.toLowerCase().includes(term)
              );
          });
      }

      // 2. Dropdown Filters
      result = result.filter(p => {
          const matchCity = filterCity === 'all' || p.city === filterCity;
          const matchType = filterType === 'all' || p.type === filterType;
          const matchLabel = filterLabel === 'all' || (p.label || '无标签') === filterLabel;
          const matchCreator = filterCreator === 'all' || p.createdBy === filterCreator;
          return matchCity && matchType && matchLabel && matchCreator;
      });

      return result;
  }, [projects, sidebarSearch, filterCity, filterType, filterLabel, filterCreator, projectTypes]);

  const groupedProjects = useMemo(() => {
    const groups: { [city: string]: Project[] } = {};
    filteredProjects.forEach(p => {
      if (!groups[p.city]) groups[p.city] = [];
      groups[p.city].push(p);
    });
    return groups;
  }, [filteredProjects]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current).setView([30.655, 104.08], 6);
    L.tileLayer('https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
        attribution: 'Map data &copy; Gaode', minZoom: 3, maxZoom: 18
    }).addTo(map);
    mapRef.current = map;
    map.on('click', () => { setActiveMarkerId(null); });
  }, []);

  // Sync Markers
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    // Cleanup old markers
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    // Prepare dropdown options string for Popup once per render
    const cityOptions = uniqueCities.map(c => `<option value="${c}">${c}</option>`).join('') + 
                       `<option value="__NEW__" style="color:blue;font-weight:bold;">[+ 新增城市...]</option>`;
    
    const labelOptions = uniqueLabels.map(l => `<option value="${l}">${l}</option>`).join('') +
                        `<option value="__NEW__" style="color:blue;font-weight:bold;">[+ 新增类别...]</option>`;

    projects.forEach((p, idx) => {
      // 1. Must be checked in the sidebar to appear
      if (!selectedIds.has(p.id)) return;

      // 2. Visibility Check: If hidden and user is guest, do not show
      if (p.isHidden && !currentUser) return;

      // 3. Must match filter criteria to be on map
      if (!filteredProjects.find(fp => fp.id === p.id)) return;

      const typeDef = projectTypes.find(t => t.key === p.type);
      const color = typeDef ? typeDef.color : '#3498db';
      const typeLabel = typeDef ? typeDef.label : p.type;

      const isActive = p.id === activeMarkerId;
      const editable = canEdit(p);

      const marker = L.marker([p.lat, p.lng], {
        // @ts-ignore
        icon: createCustomIcon(color, isActive),
        draggable: editable,
        zIndexOffset: isActive ? 1000 : 0,
        opacity: (p.isHidden && currentUser) ? 0.5 : 1 // Dim hidden markers for admin
      }).addTo(map);

      // Tooltip
      marker.bindTooltip(`${p.name}${p.isHidden ? ' (隐)' : ''}`, { 
        permanent: true, 
        direction: 'right', 
        className: 'bg-black bg-opacity-80 text-white border-none text-sm font-bold px-2 py-1 rounded shadow-md', 
        offset: [12, 0] 
      });

      const firstImage = p.images && p.images.length > 0 ? p.images[0].src : null;
      const typeSelectOptions = projectTypes.map(t => 
          `<option value="${t.key}" ${p.type === t.key ? 'selected' : ''}>${t.label}</option>`
      ).join('');

      let contentHTML = `
        <div style="text-align:center; padding:10px; min-width:220px;">
           ${firstImage ? `<div style="width:100%;height:100px;background-image:url('${firstImage}');background-size:cover;background-position:center;border-radius:4px;margin-bottom:8px;"></div>` : ''}
           <h3 style="font-weight:bold; margin-bottom:4px; font-size: 16px;">${p.name}</h3>
      `;

      if (editable) {
          // Dynamic Dropdowns for City and Label with "Add New" support
          const currentCityOpts = cityOptions.replace(`value="${p.city}"`, `value="${p.city}" selected`);
          const currentLabelOpts = labelOptions.replace(`value="${p.label}"`, `value="${p.label}" selected`);

          contentHTML += `
               <div style="margin-bottom:4px; font-size:12px; text-align:left;">
                   <label style="color:#666;">城市:</label>
                   <select onchange="window.handlePopupChange(this, '${p.id}', 'city', '${p.city}')" style="width:100%; border:1px solid #ccc; border-radius:3px; padding:2px;">
                       ${currentCityOpts}
                   </select>
               </div>
               <div style="margin-bottom:4px; font-size:12px; text-align:left;">
                   <label style="color:#666;">类型:</label>
                   <select onchange="window.updateProjectFromPopup('${p.id}', 'type', this.value)" style="width:100%; border:1px solid #ccc; border-radius:3px; padding:2px;">
                       ${typeSelectOptions}
                   </select>
               </div>
               <div style="margin-bottom:8px; font-size:12px; text-align:left;">
                   <label style="color:#666;">项目类别:</label>
                   <select onchange="window.handlePopupChange(this, '${p.id}', 'label', '${p.label}')" style="width:100%; border:1px solid #ccc; border-radius:3px; padding:2px;">
                       ${currentLabelOpts}
                   </select>
               </div>
               
               <button onclick="window.toggleProjectVisibility('${p.id}')" style="width:100%; background:${p.isHidden ? '#e74c3c' : '#2ecc71'}; color:white; border:none; padding:4px; border-radius:4px; cursor:pointer; margin-bottom:5px; font-size:12px;">
                   ${p.isHidden ? '👁️ 目前对游客隐藏 (点击公开)' : '👁️ 目前公开 (点击隐藏本项目)'}
               </button>
          `;
      } else {
           contentHTML += `
               <div style="font-size:12px; color:#666; margin-bottom:4px;">城市: ${p.city}</div>
               <div style="font-size:12px; color:#666; margin-bottom:4px;">类型: ${typeLabel}</div>
               <div style="font-size:12px; color:#666; margin-bottom:8px;">项目类别: ${p.label}</div>
           `;
      }

      contentHTML += `
           <button onclick="window.openProjectDetail('${p.id}')" style="width:100%; background:#3498db; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; margin-bottom:5px; font-weight:bold;">📝 深度调研</button>
           <div style="border-top:1px solid #eee; padding-top:5px; margin-top:5px;">
             <div style="font-size:12px; font-weight:bold; color:#27ae60; margin-bottom:5px;">🚗 导航前往</div>
             <div style="display:flex; gap:5px; justify-content:center;">
                <a href="https://uri.amap.com/marker?position=${p.lng},${p.lat}&name=${encodeURIComponent(p.name)}" target="_blank" style="font-size:12px; color:#333; text-decoration:none; background:#f0f0f0; padding:4px 8px; border-radius:3px;">高德</a>
                <a href="http://api.map.baidu.com/marker?location=${p.lat},${p.lng}&title=${encodeURIComponent(p.name)}&content=${encodeURIComponent(p.name)}&output=html" target="_blank" style="font-size:12px; color:#333; text-decoration:none; background:#f0f0f0; padding:4px 8px; border-radius:3px;">百度</a>
             </div>
           </div>
           ${editable ? '<div style="font-size:10px;color:#e67e22;margin-top:5px;">(长按或拖拽可移动位置)</div>' : ''}
        </div>
      `;

      marker.bindPopup(contentHTML);
      if (isActive && !marker.isPopupOpen()) marker.openPopup();

      marker.on('click', (e) => {
          setActiveMarkerId(p.id); 
          const el = document.getElementById(`project-row-${p.id}`);
          if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      marker.on('dragend', async (e) => {
          const newPos = e.target.getLatLng();
          const updated = { ...p, lat: newPos.lat, lng: newPos.lng };
          setProjects(prev => prev.map(proj => proj.id === p.id ? updated : proj));
          await db.saveProject(updated);
      });

      markersRef.current[p.id] = marker;
    });
  }, [projects, selectedIds, activeMarkerId, currentUser, filteredProjects, projectTypes, uniqueCities, uniqueLabels]); // Added uniqueCities, uniqueLabels

  const canEdit = (project: Project) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'editor') {
        return project.createdBy === currentUser.id;
    } 
    return false;
  };

  const hasWriteAccess = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  const isAdmin = currentUser && currentUser.role === 'admin';

  const handleLogout = async () => { await db.logout(); setCurrentUser(null); setActiveMarkerId(null); };

  const confirmAddCity = async (city: string) => {
      const center = mapRef.current?.getCenter() || { lat: 30.655, lng: 104.08 };
      const newProject: Project = { 
          id: Date.now().toString(), 
          name: '新建项目', 
          city, 
          type: 'Commercial', 
          label: '待定', 
          lat: center.lat, lng: center.lng, 
          isHidden: false,
          publicDescription: '', images: [],
          createdBy: currentUser!.id, 
          createdByName: currentUser!.name 
      };
      await db.saveProject(newProject);
      loadProjects();
      setShowAddCityModal(false);
  };

  const confirmAddProject = async (city: string, name: string, type: string, label: string) => {
      const center = mapRef.current?.getCenter() || { lat: 30.655, lng: 104.08 };
      const newProject: Project = { 
          id: Date.now().toString(), 
          name, city, type, label,
          lat: center.lat, lng: center.lng,
          isHidden: false,
          publicDescription: '', images: [],
          createdBy: currentUser!.id, 
          createdByName: currentUser!.name 
      };
      await db.saveProject(newProject);
      loadProjects();
      setShowAddProjectModal(false);
  };

  const handleAddType = async (newType: ProjectTypeDef) => {
      await db.addProjectType(newType);
      loadTypes();
  }

  const handleRenameLabel = async () => {
      if(filterLabel === 'all') return;
      const newName = prompt(`将项目类别 "${filterLabel}" 重命名为:`);
      if(newName && newName.trim() && newName !== filterLabel) {
          await db.renameProjectLabel(filterLabel, newName.trim());
          loadProjects();
          setFilterLabel(newName.trim()); 
      }
  };

  const handleRenameProject = async (p: Project) => {
      if(!canEdit(p)) { alert("无权编辑"); return; }
      const newName = prompt("重命名项目:", p.name);
      if(newName && newName !== p.name) {
          const updated = { ...p, name: newName };
          await db.saveProject(updated);
          loadProjects();
      }
  };

  const handleDeleteProject = async (p: Project) => {
    if (!canEdit(p)) { alert("无权删除此项目"); return; }
    if (!confirm(`确定删除 ${p.name}?`)) return;
    await db.deleteProject(p.id);
    loadProjects();
  };
  
  const handleDeleteCity = async (city: string) => {
      if(!currentUser || currentUser.role !== 'admin') { alert("只有主管理员可以删除城市。"); return; }
      if(confirm(`确定删除城市 [${city}] 及该城市下所有项目吗？`)) {
          // @ts-ignore
          if(db.deleteProjectsByCity) await db.deleteProjectsByCity(city);
          loadProjects();
      }
  };

  const handleAddProjectToCity = (city: string) => {
      if (!hasWriteAccess) return alert("无权操作");
      setAddProjectCity(city);
      setShowAddProjectModal(true);
  };

  const handleDragStart = (e: React.DragEvent, project: Project) => {
      if(!isAdmin) return; 
      setDraggedProject(project);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
      if(!isAdmin) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetProject: Project) => {
      if(!isAdmin || !draggedProject) return;
      e.preventDefault();
      if(draggedProject.id === targetProject.id) return;
      const newProjects = [...projects];
      const sourceIndex = newProjects.findIndex(p => p.id === draggedProject.id);
      const targetIndex = newProjects.findIndex(p => p.id === targetProject.id);
      if(sourceIndex !== -1 && targetIndex !== -1) {
          const [removed] = newProjects.splice(sourceIndex, 1);
          newProjects.splice(targetIndex, 0, removed);
          setProjects(newProjects);
          setDraggedProject(null);
          // @ts-ignore
          if(db.saveProjectsList) await db.saveProjectsList(newProjects);
      }
  };

  const exportJSON = () => {
      const dataStr = JSON.stringify(projects, null, 2);
      const blob = new Blob([dataStr], {type: "application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tztw_data_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const imported = JSON.parse(evt.target?.result as string);
              if(Array.isArray(imported)) {
                  // Ensure Additive behavior: Loop through imported and save each.
                  // Existing projects with same ID will be updated, new ones added.
                  // No data is cleared.
                  for(const p of imported) {
                      await db.saveProject(p);
                  }
                  loadProjects();
                  alert("数据导入成功！(已合并至现有项目)");
              }
          } catch(err) {
              alert("文件格式错误");
          }
      };
      reader.readAsText(file);
      e.target.value = ''; 
  };

  const handleExportPDF = () => {
      setShowExportFilter(true);
  };
  
  const handleExportHTML = () => {
      setShowExportHTML(true);
  };

  const [isResizing, setIsResizing] = useState(false);
  useEffect(() => {
      const up = () => setIsResizing(false);
      const move = (e: MouseEvent | TouchEvent) => {
          if(isResizing) {
             const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
             const w = (clientX / window.innerWidth) * 100;
             if(w > 15 && w < 70) setSidebarWidth(w);
             mapRef.current?.invalidateSize();
          }
      }
      if(isResizing) { window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); window.addEventListener('touchmove', move); window.addEventListener('touchend', up); }
      return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); window.removeEventListener('touchmove', move); window.addEventListener('touchend', up); }
  }, [isResizing]);

  const focusProject = (p: Project) => { 
      mapRef.current?.setView([p.lat, p.lng], 16); 
      markersRef.current[p.id]?.openPopup(); 
      setActiveMarkerId(p.id);
  };
  
  // Selection Logic
  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if(newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const toggleCitySelection = (cityProjects: Project[]) => {
      const allSelected = cityProjects.every(p => selectedIds.has(p.id));
      const newSet = new Set(selectedIds);
      cityProjects.forEach(p => {
          if(allSelected) newSet.delete(p.id);
          else newSet.add(p.id);
      });
      setSelectedIds(newSet);
  };

  const focusCity = (cityProjects: Project[]) => {
      if(cityProjects.length && mapRef.current) {
          const bounds = L.latLngBounds(cityProjects.map(p => [p.lat, p.lng]));
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans text-[#333]">
      <div className="bg-white shadow-lg flex flex-col z-[1000] border-r border-gray-200" style={{ width: `${sidebarWidth}%`, minWidth: '250px' }}>
        <div className="bg-[#2c3e50] text-white p-4 shrink-0">
          <div className="flex justify-between items-center mb-2">
             <h2 className="text-lg font-bold">TZTW 项目管理系统</h2>
             {currentUser ? (
                <div className="flex gap-2 text-xs">
                    <span className="bg-blue-600 px-2 py-1 rounded">👤 {currentUser.name}</span>
                    {currentUser.role === 'admin' && <button onClick={() => setShowAdmin(true)} className="bg-purple-600 px-2 py-1 rounded hover:bg-purple-700">后台</button>}
                    <button onClick={handleLogout} className="bg-red-500 px-2 py-1 rounded hover:bg-red-600">退出</button>
                </div>
             ) : <button onClick={() => setShowLogin(true)} className="bg-green-600 text-xs px-3 py-1 rounded font-bold hover:bg-green-700">登录</button>}
          </div>
          <div className="flex gap-2 mb-3">
             {hasWriteAccess && (
                 <ExportDropdown 
                    onExportJSON={exportJSON} 
                    onExportPDF={handleExportPDF} 
                    onExportHTML={handleExportHTML}
                    onImportJSON={importJSON} 
                    currentUser={currentUser}
                 />
             )}
             <button onClick={() => setShowGuide(true)} className={`flex-1 bg-[#f39c12] text-white py-1 px-2 rounded text-xs font-bold flex items-center justify-center gap-1 ${!hasWriteAccess ? 'w-full' : ''}`}>🗺️ 旅行条件</button>
          </div>
          
          {/* Search Box */}
          <div className="relative mb-2">
              <input 
                  type="text" 
                  className="w-full p-2 pl-8 rounded text-black text-sm" 
                  placeholder="🔍 搜索项目名称、类型、属性..." 
                  value={sidebarSearch}
                  onChange={e => setSidebarSearch(e.target.value)}
              />
              <i className="fa-solid fa-search absolute left-2 top-3 text-gray-400 text-xs"></i>
          </div>

          {/* Sidebar Filter Bar */}
          <div className="bg-[#34495e] p-2 rounded text-xs flex flex-col gap-2">
              <div className="flex gap-1">
                  <select className="flex-1 bg-white text-black p-1 rounded" value={filterCity} onChange={e => setFilterCity(e.target.value)}>
                      <option value="all">全部城市</option>
                      {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="flex-1 bg-white text-black p-1 rounded" value={filterType} onChange={e => setFilterType(e.target.value)}>
                      <option value="all">全部类型</option>
                      {projectTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
              </div>
              <div className="flex gap-1">
                  <div className="flex-[2] flex">
                      <select className="flex-1 bg-white text-black p-1 rounded-l" value={filterLabel} onChange={e => setFilterLabel(e.target.value)}>
                          <option value="all">全部{labelFieldName}</option>
                          {uniqueLabels.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                      {hasWriteAccess && filterLabel !== 'all' && (
                          <button 
                            onClick={handleRenameLabel}
                            className="bg-blue-600 text-white px-2 rounded-r hover:bg-blue-700"
                            title="重命名该类别"
                          >
                              <i className="fa-solid fa-pencil"></i>
                          </button>
                      )}
                  </div>
                  
                  {/* Creator Filter - Only visible to Main Admin */}
                  {currentUser?.role === 'admin' && (
                      <select className="flex-1 bg-white text-black p-1 rounded" value={filterCreator} onChange={e => setFilterCreator(e.target.value)}>
                          <option value="all">全部创建人</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                  )}
              </div>
          </div>
        </div>

        <div id="sidebar-content" className="flex-1 overflow-y-auto bg-[#f8f9fa]">
          {Object.entries(groupedProjects).map(([city, list]: [string, Project[]]) => {
            // Check if ALL projects in this filtered list for this city are selected
            const allSelected = list.every(p => selectedIds.has(p.id));
            
            return (
                <div key={city} className="bg-white mb-2 border-b border-gray-100">
                <div 
                    className="p-3 font-bold text-[#2c3e50] bg-white border-b sticky top-0 z-10 flex justify-between items-center hover:bg-gray-50 cursor-pointer"
                    onClick={() => focusCity(list)}
                >
                    <div className="flex items-center gap-2" onClick={(e) => { e.stopPropagation(); toggleCitySelection(list); }}>
                        <input 
                            type="checkbox" 
                            checked={allSelected} 
                            readOnly
                            className="w-4 h-4 cursor-pointer"
                        />
                        <span>🏙️ {city} ({list.length})</span>
                    </div>
                    <div className="flex gap-2">
                    {hasWriteAccess && (
                        <>
                        <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteCity(city); }} 
                                className="w-6 h-6 text-gray-400 hover:text-red-500 rounded flex items-center justify-center text-xs transition-colors" 
                        >
                                <i className="fa-solid fa-trash"></i>
                        </button>
                        <button 
                                onClick={(e) => { e.stopPropagation(); handleAddProjectToCity(city); }} 
                                className="w-6 h-6 bg-blue-500 text-white rounded flex items-center justify-center text-xs hover:bg-blue-600 shadow" 
                        >
                                <i className="fa-solid fa-plus"></i>
                        </button>
                        </>
                    )}
                    </div>
                </div>
                {list.map((proj, idx) => {
                    const typeDef = projectTypes.find(t => t.key === proj.type);
                    return (
                        <div 
                            key={proj.id} 
                            id={`project-row-${proj.id}`}
                            className={`flex items-center p-2 border-b border-gray-50 hover:bg-gray-100 cursor-pointer ${activeMarkerId === proj.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''} ${isAdmin ? 'active:cursor-grabbing' : ''}`}
                            onClick={() => focusProject(proj)} 
                            draggable={isAdmin}
                            onDragStart={(e) => handleDragStart(e, proj)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, proj)}
                        >
                            {/* Checkbox for selection */}
                            <div className="mr-2" onClick={(e) => { e.stopPropagation(); toggleSelection(proj.id); }}>
                                <input type="checkbox" checked={selectedIds.has(proj.id)} readOnly className="cursor-pointer" />
                            </div>

                            <span className={`text-gray-300 mr-2 ${isAdmin ? 'cursor-grab' : ''}`}>⋮⋮</span>
                            
                            <div className="flex-1 overflow-hidden">
                                <div className="flex items-center gap-2">
                                    <span 
                                        className={`text-sm truncate font-medium ${proj.isHidden ? 'text-gray-400' : 'text-gray-800'}`}
                                        onDoubleClick={(e) => { e.stopPropagation(); handleRenameProject(proj); }}
                                    >
                                        {proj.name} {proj.isHidden && <i className="fa-solid fa-eye-slash text-xs ml-1" title="游客不可见"></i>}
                                    </span>
                                    {canEdit(proj) && (
                                        <button onClick={(e) => { e.stopPropagation(); handleRenameProject(proj); }} className="text-gray-400 hover:text-blue-500 text-xs">
                                            <i className="fa-solid fa-pencil"></i>
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                    <span className={`text-[10px] px-1 rounded border ${typeDef?.bgColorClass || 'bg-gray-100 text-gray-500'}`}>{typeDef?.label || proj.type}</span>
                                    {proj.label && <span className="text-[10px] text-gray-500 bg-gray-100 px-1 rounded">{proj.label}</span>}
                                </div>
                            </div>
                            <div className="flex gap-1">
                            {canEdit(proj) && (
                                <button 
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-gray-400 hover:bg-red-500 hover:text-white transition-colors" 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteProject(proj); }} 
                                >
                                    <i className="fa-solid fa-times"></i>
                                </button>
                            )}
                            </div>
                        </div>
                    );
                })}
                </div>
            );
          })}
          {Object.keys(groupedProjects).length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">暂无符合条件的项目</div>
          )}
        </div>
        {currentUser && (
            <div className="p-4 bg-white border-t flex gap-2">
                <button onClick={() => setShowAddCityModal(true)} className="flex-1 bg-[#8e44ad] text-white py-2 rounded font-bold text-sm flex items-center justify-center gap-1 hover:bg-[#732d91]"><i className="fa-solid fa-city"></i> 新增城市</button>
            </div>
        )}
      </div>

      <div className="w-[10px] bg-[#f1f1f1] border-l border-r border-gray-300 cursor-col-resize flex items-center justify-center z-[1001] hover:bg-gray-200" onMouseDown={() => setIsResizing(true)} onTouchStart={() => setIsResizing(true)}>
          <span className="text-gray-400 text-[10px] tracking-widest pointer-events-none">||</span>
      </div>

      <div className="flex-1 relative bg-gray-100 z-0" ref={mapContainerRef}>
          {/* Map is rendered here */}
          <MapSearch map={mapRef.current} />
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={setCurrentUser} />}
      {showAddProjectModal && (
          <AddProjectModal 
            initialCity={addProjectCity} 
            labelName={labelFieldName}
            availableCities={uniqueCities}
            availableLabels={uniqueLabels}
            projectTypes={projectTypes}
            currentUser={currentUser}
            onClose={() => setShowAddProjectModal(false)} 
            onConfirm={confirmAddProject} 
            onAddType={handleAddType}
          />
      )}
      {showAddCityModal && (
          <AddCityModal 
            onClose={() => setShowAddCityModal(false)} 
            onConfirm={confirmAddCity} 
          />
      )}
      {showAdmin && <AdminPanel projects={projects} onClose={() => setShowAdmin(false)} />}
      
      {/* Pass only VISIBLE/SELECTED projects to the Guide Modal */}
      {showGuide && <GuideModal projects={projects.filter(p => selectedIds.has(p.id))} projectTypes={projectTypes} onClose={() => setShowGuide(false)} />}
      
      {showExportFilter && <ExportFilterModal 
            projects={projects.filter(p => selectedIds.has(p.id))} 
            projectTypes={projectTypes} 
            labelName={labelFieldName} 
            currentUser={currentUser} 
            onClose={() => setShowExportFilter(false)} 
      />}
      
      {showExportHTML && <ExportHTMLModal
            projects={projects.filter(p => selectedIds.has(p.id))}
            projectTypes={projectTypes}
            onClose={() => setShowExportHTML(false)}
      />}
      
      {activeProject && (
          <ProjectDetailModal 
            project={activeProject} 
            currentUser={currentUser}
            labelName={labelFieldName} 
            projectTypes={projectTypes}
            availableCities={uniqueCities}
            availableLabels={uniqueLabels}
            onClose={() => setActiveProject(null)} 
            onSave={(updated) => { setProjects(prev => prev.map(p => p.id === updated.id ? updated : p)); }} 
          />
      )}
    </div>
  );
}