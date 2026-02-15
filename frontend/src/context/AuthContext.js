import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem('user');
    const storedToken = sessionStorage.getItem('token');
    if (stored) setUser(JSON.parse(stored));
    if (storedToken) setToken(storedToken);
    setLoading(false);
  }, []);

  const login = (data) => {
    const userData = data?.user || data;
    const tokenData = data?.token || null;

    setUser(userData);
    sessionStorage.setItem('user', JSON.stringify(userData));

    if (tokenData) {
      setToken(tokenData);
      sessionStorage.setItem('token', tokenData);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
