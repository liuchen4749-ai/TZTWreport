import { Project, ProjectTypeDef } from '../types';

export const generateStandaloneHTML = (projects: Project[], projectTypes: ProjectTypeDef[], title: string, permission: 'admin' | 'guest') => {
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

    // Extract unique values for filters based ONLY on exported data
    const cities = Array.from(new Set(safeData.map(p => p.city))).sort();
    const labels = Array.from(new Set(safeData.map(p => p.label))).sort();
    
    // Filter project types to only those present in the exported data
    const usedTypeKeys = new Set(safeData.map(p => p.type));
    const usedProjectTypes = projectTypes.filter(t => usedTypeKeys.has(t.key));

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
            
            ${permission === 'admin' ? `
            <div class="p-4 bg-white border-t">
                <button onclick="addNewCity()" class="w-full bg-[#8e44ad] text-white py-2 rounded font-bold text-sm hover:bg-[#732d91]"><i class="fa-solid fa-city"></i> 新增城市</button>
            </div>` : ''}
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
        // Only use filtered types logic for the exported HTML
        const TYPES = ${JSON.stringify(usedProjectTypes)};
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
                        <div class="p-3 bg-gray-100 font-bold sticky top-0 flex justify-between items-center hover:bg-gray-200 cursor-pointer" onclick="focusCity('\${city}')">
                            <div class="flex items-center gap-2" onclick="event.stopPropagation(); toggleCitySelect('\${city}')">
                                <input type="checkbox" \${allSelected ? 'checked' : ''} class="w-4 h-4 cursor-pointer">
                                <span onclick="event.stopPropagation(); focusCity('\${city}')" title="点击定位城市">🏙️ \${city} (\${list.length})</span>
                            </div>
                            <div class="flex gap-2">
                                \${PERMISSION === 'admin' ? \`
                                <button onclick="event.stopPropagation(); addProject('\${city}')" class="text-blue-500 hover:text-blue-700" title="添加项目"><i class="fa-solid fa-plus"></i></button>
                                <button onclick="event.stopPropagation(); deleteCity('\${city}')" class="text-gray-400 hover:text-red-500" title="删除城市"><i class="fa-solid fa-trash"></i></button>
                                \` : ''}
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
                            draggable: PERMISSION === 'admin'
                        }).addTo(map);
                        
                        if(PERMISSION === 'admin') {
                            marker.on('dragend', (e) => {
                                p.lat = e.target.getLatLng().lat;
                                p.lng = e.target.getLatLng().lng;
                            });
                        }
                        
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
                                    \${PERMISSION === 'admin' ? \`<button onclick="event.stopPropagation(); renameItem('\${p.id}')" class="text-xs text-gray-300 hover:text-blue-500"><i class="fa-solid fa-pencil"></i></button>\` : ''}
                                </div>
                                <div class="text-xs text-gray-500 mt-1">
                                    <span class="border px-1 rounded" style="background-color: \${typeDef?.bgColorClass ? '' : '#eee'}">\${typeDef?.label || p.type}</span> 
                                    <span class="bg-gray-100 px-1 rounded">\${p.label}</span>
                                </div>
                            </div>
                            \${PERMISSION === 'admin' ? \`<button onclick="event.stopPropagation(); deleteItem('\${p.id}')" class="text-gray-300 hover:text-red-500"><i class="fa-solid fa-times"></i></button>\` : ''}
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
                    <img src="\${img.src}" class="w-full h-48 object-contain bg-black rounded mb-2">
                    <div class="text-sm bg-gray-50 p-1">\${img.caption || '无描述'}</div>
                </div>
            \`).join('');

            let internalHtml = '';
            if (PERMISSION === 'admin' && (p.internalDescription || (p.internalImages && p.internalImages.length))) {
                const intImgs = (p.internalImages || []).map(img => \`
                    <div class="border p-2 rounded bg-white">
                        <img src="\${img.src}" class="w-full h-48 object-contain bg-black rounded mb-2">
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