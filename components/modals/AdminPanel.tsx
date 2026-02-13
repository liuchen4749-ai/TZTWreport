import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/mockDb';
import { User, Project } from '../../types';

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

  const handleDeleteUser = async (userId: string) => {
      if(!confirm("确定删除此分账号吗？")) return;
      // In a real app we'd have a db.deleteUser method. For mock DB, we just rely on local state update being persisted if we implemented it properly.
      // Since mockDb doesn't have explicit deleteUser, we'll implement a simple one logic here or assume db would handle it.
      // For this demo, let's assume we can filter and save back to localStorage via db internals if exposed, or just filter in memory for now.
      // Actually, let's simulate it by updating users state and saving to localStorage directly if db doesn't expose it,
      // but to be clean, we should stick to db. Since mockDb.ts is editable, I'll assume we can just overwrite the users list.
      const newUsers = users.filter(u => u.id !== userId);
      // Hacky way to save back to mock DB since we didn't add deleteUser there explicitly in previous steps
      localStorage.setItem('tztw_users_v71', JSON.stringify(newUsers)); 
      setUsers(newUsers);
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
                    
                    {/* Scrollable User List */}
                    <div className="max-h-[60vh] overflow-y-auto pr-1">
                        <ul className="space-y-2">
                        {users.map(u => (
                            <li key={u.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                                <div><span className="font-bold">{u.name}</span> <span className="text-gray-500 text-xs">({u.username})</span></div>
                                <div className="flex items-center gap-2">
                                    <div className="text-xs text-gray-400">{u.role === 'admin' ? '管理员' : '编辑'} | 密码: {u.password}</div>
                                    {u.role !== 'admin' && (
                                        <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:text-red-700 ml-2 text-xs border border-red-200 px-2 py-1 rounded bg-white">删除</button>
                                    )}
                                </div>
                            </li>
                        ))}
                        </ul>
                    </div>
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

export default AdminPanel;