import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { db } from './services/mockDb';
import { Project, User, ProjectTypeDef } from './types';
import { createCustomIcon } from './utils/mapUtils';

// Components
import ImageViewer from './components/common/ImageViewer';
import MapSearch from './components/common/MapSearch';
import ExportDropdown from './components/common/ExportDropdown';
import LoginModal from './components/modals/LoginModal';
import AddCityModal from './components/modals/AddCityModal';
import AddProjectModal from './components/modals/AddProjectModal';
import AdminPanel from './components/modals/AdminPanel';
import GuideModal from './components/modals/GuideModal';
import ExportFilterModal from './components/modals/ExportFilterModal';
import ExportHTMLModal from './components/modals/ExportHTMLModal';
import ProjectDetailModal from './components/modals/ProjectDetailModal';

// Declare html2pdf for TypeScript if needed in global scope (though used in utils/modals now)
declare const html2pdf: any;

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
  
  // Collapsed Cities State
  const [collapsedCities, setCollapsedCities] = useState<Set<string>>(new Set());

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

      // Handle TYPE dropdown logic for Map Popup (New Feature)
      // @ts-ignore
      window.handlePopupTypeChange = async (element: HTMLSelectElement, id: string, oldValue: string) => {
          if (element.value === '__NEW_TYPE__') {
              const newLabel = prompt("请输入新项目类型名称 (如: 产业园):");
              if (newLabel && newLabel.trim()) {
                  const key = 'Type_' + Date.now();
                  const colors = ['#e74c3c', '#8e44ad', '#3498db', '#1abc9c', '#f1c40f', '#e67e22', '#34495e'];
                  const randomColor = colors[Math.floor(Math.random() * colors.length)];
                  const newType: ProjectTypeDef = {
                      key,
                      label: newLabel.trim(),
                      color: randomColor,
                      bgColorClass: 'bg-gray-100 text-gray-800 border-gray-200'
                  };
                  await db.addProjectType(newType);
                  
                  // Reload types locally to update state
                  const types = await db.getProjectTypes();
                  setProjectTypes(types);
                  
                  // Update the project
                  // @ts-ignore
                  window.updateProjectFromPopup(id, 'type', key);
              } else {
                  element.value = oldValue;
              }
          } else {
              // @ts-ignore
              window.updateProjectFromPopup(id, 'type', element.value);
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
      
      // Dynamic Type Options with "Add New"
      const typeSelectOptions = projectTypes.map(t => 
          `<option value="${t.key}" ${p.type === t.key ? 'selected' : ''}>${t.label}</option>`
      ).join('') + `<option value="__NEW_TYPE__" style="color:green;font-weight:bold;">[+ 新增类型...]</option>`;

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
                   <select onchange="window.handlePopupTypeChange(this, '${p.id}', '${p.type}')" style="width:100%; border:1px solid #ccc; border-radius:3px; padding:2px;">
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
  }, [projects, selectedIds, activeMarkerId, currentUser, filteredProjects, projectTypes, uniqueCities, uniqueLabels]); 

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

  const toggleCityCollapse = (city: string) => {
      const newSet = new Set(collapsedCities);
      if(newSet.has(city)) newSet.delete(city);
      else newSet.add(city);
      setCollapsedCities(newSet);
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
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden font-sans text-[#333]">
      {/* Sidebar Content (Left on Desktop, Bottom on Mobile) */}
      <div 
        className="order-2 md:order-1 bg-white shadow-lg flex flex-col z-[1000] border-r border-gray-200 h-[60vh] md:h-full w-full md:w-auto" 
        style={{ width: window.innerWidth > 768 ? `${sidebarWidth}%` : '100%', minWidth: '250px' }}
      >
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
            const isCollapsed = collapsedCities.has(city);
            
            return (
                <div key={city} className="bg-white mb-2 border-b border-gray-100">
                {/* City Header - Click Anywhere to toggle collapse */}
                <div 
                    className="p-3 font-bold text-[#2c3e50] bg-white border-b sticky top-0 z-10 flex justify-between items-center hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleCityCollapse(city)}
                >
                    <div className="flex items-center gap-2">
                        {/* Checkbox: Stop propagation to prevent collapse when just checking */}
                        <div onClick={(e) => { e.stopPropagation(); toggleCitySelection(list); }} className="flex items-center">
                            <input 
                                type="checkbox" 
                                checked={allSelected} 
                                readOnly
                                className="w-4 h-4 cursor-pointer"
                            />
                        </div>
                        {/* City Name: Stop propagation if you want click to focus map, OR let it collapse. 
                            User requirement: "click can collapse". Let's assume click on text collapses. 
                            Right side has map buttons. */}
                        <span>
                            {isCollapsed ? '▶' : '▼'} 🏙️ {city} ({list.length})
                        </span>
                    </div>
                    <div className="flex gap-2">
                        {/* Focus Map Button */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); focusCity(list); }}
                            className="text-gray-400 hover:text-blue-500 px-1"
                            title="定位城市"
                        >
                            <i className="fa-solid fa-crosshairs"></i>
                        </button>

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
                
                {/* Project List - Condition on isCollapsed */}
                {!isCollapsed && list.map((proj, idx) => {
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

      <div 
        className="hidden md:flex w-[10px] bg-[#f1f1f1] border-l border-r border-gray-300 cursor-col-resize items-center justify-center z-[1001] hover:bg-gray-200" 
        onMouseDown={() => setIsResizing(true)}
      >
          <span className="text-gray-400 text-[10px] tracking-widest pointer-events-none">||</span>
      </div>

      {/* Map Content (Top on Mobile 2/5, Right on Desktop) */}
      <div 
        className="order-1 md:order-2 flex-1 relative bg-gray-100 z-0 h-[40vh] md:h-full w-full md:w-auto" 
        ref={mapContainerRef}
      >
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