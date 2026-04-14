import React, { useState, useRef, useEffect } from 'react';
import { Github, ChevronDown, Check, RefreshCw } from 'lucide-react';
import { useRepo } from '../context/RepoContext';

export default function RepoSelector() {
  const { repos, selectedRepo, selectRepo, loadingRepos, fetchRepos } = useRepo();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loadingRepos && !selectedRepo) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-theme bg-surface-secondary text-steel-400 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Loading Repos...</span>
      </div>
    );
  }

  if (repos.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-theme hover:border-emerald-500/30 bg-surface text-steel-200 text-sm font-medium transition-all group max-w-[200px] sm:max-w-xs"
      >
        <Github className="w-4 h-4 text-steel-400 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
        <span className="truncate">{selectedRepo?.name || 'Select Repository'}</span>
        <ChevronDown className={`w-4 h-4 text-steel-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-surface/95 backdrop-blur-xl border border-theme-strong rounded-xl shadow-2xl z-50 overflow-hidden py-1">
          <div className="px-3 py-2 border-b border-theme flex items-center justify-between">
            <span className="text-xs font-semibold text-steel-500 uppercase tracking-wider">Your Repositories</span>
            <button onClick={() => fetchRepos()} className="text-steel-400 hover:text-emerald-400" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRepos ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto overlay-scrollbar">
            {repos.map(repo => (
              <button
                key={repo.full_name}
                onClick={() => {
                  selectRepo(repo.full_name);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-emerald-500/10 ${
                  selectedRepo?.full_name === repo.full_name
                    ? 'text-emerald-400 bg-emerald-500/5'
                    : 'text-steel-300'
                }`}
              >
                <Github className="w-4 h-4 flex-shrink-0 opacity-70" />
                <div className="flex-1 truncate">
                  <div className="truncate font-medium">{repo.name}</div>
                  <div className="text-[10px] text-steel-500 truncate">{repo.full_name}</div>
                </div>
                {selectedRepo?.full_name === repo.full_name && (
                  <Check className="w-4 h-4 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
