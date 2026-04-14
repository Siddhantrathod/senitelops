import React from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * A wrapper component that only renders its children if the current user
 * has the required permission.
 * 
 * @param {Object} props
 * @param {string} props.permission - The permission required (e.g. 'pipelines.run')
 * @param {React.ReactNode} props.children - The content to render if permitted
 * @param {React.ReactNode} [props.fallback=null] - What to render if not permitted
 */
export default function PermissionGate({ permission, children, fallback = null }) {
  const { hasPermission } = useAuth();
  
  if (!hasPermission(permission)) {
    return fallback;
  }
  
  return <>{children}</>;
}
