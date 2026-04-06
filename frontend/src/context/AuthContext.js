import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import {
  loginUser,
  logoutUser,
  getMe,
  refreshAccessToken,
  setAccessToken,
  setOnUnauthorized,
} from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    setAccessToken(null);
  }, []);

  const fetchUser = useCallback(async () => {
    const response = await getMe();
    setUser(response.data);
    return response.data;
  }, []);

  const login = useCallback(
    async (payload) => {
      if (!payload) {
        return null;
      }

      if (payload.email && payload.password) {
        const response = await loginUser({
          email: payload.email,
          password: payload.password,
        });
        const accessToken = response.data?.accessToken || response.data?.token || null;
        if (accessToken) {
          setToken(accessToken);
          setAccessToken(accessToken);
        }
        const me = await fetchUser();
        return me;
      }

      const accessToken = payload.accessToken || payload.token || null;
      if (accessToken) {
        setToken(accessToken);
        setAccessToken(accessToken);
        const me = await fetchUser();
        return me;
      }

      return null;
    },
    [fetchUser]
  );

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch (err) {
      // Ignore network errors on logout
    }
    clearAuth();
  }, [clearAuth]);

  useEffect(() => {
    setOnUnauthorized(() => {
      clearAuth();
    });

    const initialize = async () => {
      try {
        await fetchUser();
        setLoading(false);
        return;
      } catch (err) {
        try {
          const nextToken = await refreshAccessToken();
          if (nextToken) {
            setToken(nextToken);
            await fetchUser();
          } else {
            clearAuth();
          }
        } catch (refreshError) {
          clearAuth();
        } finally {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      setOnUnauthorized(null);
    };
  }, [clearAuth, fetchUser]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, fetchUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
