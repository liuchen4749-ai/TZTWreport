import React, { useState, useRef } from 'react';
import { db } from '../../services/mockDb';
import { Project, User, ImageItem, Attachment, ProjectTypeDef } from '../../types';
import ImageGrid from '../common/ImageGrid';
import ImageViewer from '../common/ImageViewer';
import SourceModal from './SourceModal';
import CompressModal from './CompressModal';

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
  
  // Image Viewer State
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  
  // File inputs Refs
  const albumInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const attachmentRef = useRef<HTMLInputElement>(null);

  // Permissions
  const isAdmin = currentUser?.role === 'admin';
  const isCreator = currentUser?.id === project.createdBy;
  
  // Basic edit rights: Admin can edit all. Creator can edit own.
  const canEditPublic = isAdmin || isCreator;
  
  // Internal Info Privacy
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

  const handleClose = () => {
      // 1. Close Modal Immediately
      onClose();

      // 2. Save in background if edited (Fire and Forget)
      if (canEditPublic) {
          const updated: Project = { 
              ...project, 
              name: editName, 
              city: editCity, 
              type: editType, 
              label: editLabel,
              publicDescription: publicDesc,
              images: publicImages,
              internalDescription: canEditInternal ? internalDesc : project.internalDescription,
              internalImages: canEditInternal ? internalImages : project.internalImages,
              attachments: canEditInternal ? attachments : project.attachments
          };
          
          db.saveProject(updated).then(() => {
              onSave(updated); // Update parent state eventually
          });
      }
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
      <div className="bg-white rounded-lg w-[70vw] max-w-[95%] h-[90vh] flex flex-col shadow-2xl border-4 border-[#333]">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <span className="font-bold text-lg flex-1 mr-4 break-words">
              {canEditPublic ? (
                  <input className="w-full border-b border-gray-400 bg-transparent focus:outline-none" value={editName} onChange={e=>setEditName(e.target.value)} />
              ) : project.name}
          </span>
          <div className="flex items-center gap-4 shrink-0">
             {saving && <span className="text-green-600 text-xs animate-pulse">后台保存中...</span>}
             <button onClick={handleClose} className="text-2xl text-gray-500 hover:text-black">✕</button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto bg-[#f0f2f5] p-0 flex flex-col custom-scrollbar">
          {/* Metadata Section */}
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
                onImageClick={(img) => setViewingImage(img.src)}
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
                        onImageClick={(img) => setViewingImage(img.src)}
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
      
      {viewingImage && <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />}
    </div>
  );
};

export default ProjectDetailModal;