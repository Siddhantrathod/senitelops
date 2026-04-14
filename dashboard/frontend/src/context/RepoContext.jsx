import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const RepoContext = createContext();

export function RepoProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [loadingRepos, setLoadingRepos] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRepos();
    } else {
      setRepos([]);
      setSelectedRepo(null);
    }
  }, [isAuthenticated]);

  const fetchRepos = async () => {
    setLoadingRepos(true);
    try {
      const response = await api.get('/github/repos');
      const data = response.data;
      if (data && data.repos) {
        setRepos(data.repos);
        
        // Restore previously selected if any, else pick first
        const saved = localStorage.getItem('sentinelops_selected_repo');
        const found = data.repos.find(r => r.full_name === saved);
        if (found) {
          setSelectedRepo(found);
        } else if (data.repos.length > 0) {
          setSelectedRepo(data.repos[0]);
          localStorage.setItem('sentinelops_selected_repo', data.repos[0].full_name);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user GitHub repos:', error);
    } finally {
      setLoadingRepos(false);
    }
  };

  const selectRepo = (repoFullName) => {
    const repo = repos.find(r => r.full_name === repoFullName);
    if (repo) {
      setSelectedRepo(repo);
      localStorage.setItem('sentinelops_selected_repo', repoFullName);
      // Fire an event in case components need to refetch immediately on change
      window.dispatchEvent(new CustomEvent('sentinelops:repo-changed', { detail: repo }));
    }
  };

  return (
    <RepoContext.Provider value={{ repos, selectedRepo, selectRepo, loadingRepos, fetchRepos }}>
      {children}
    </RepoContext.Provider>
  );
}

export function useRepo() {
  return useContext(RepoContext);
}
