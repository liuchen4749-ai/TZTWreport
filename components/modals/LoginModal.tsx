import React, { useState } from 'react';
import { db } from '../../services/mockDb';
import { User } from '../../types';

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
      </div>
    </div>
  );
};

export default LoginModal;