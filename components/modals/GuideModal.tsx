import React, { useState } from 'react';
import { Project, ProjectTypeDef } from '../../types';

declare const html2pdf: any;

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

export default GuideModal;