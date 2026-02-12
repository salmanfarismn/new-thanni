/**
 * PrivateRoute Component
 * Protects routes that require authentication.
 * Supports role-based access control with allowedRoles prop.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated, getUserRole } from '../api/axios';

export default function PrivateRoute({ children, allowedRoles }) {
    const location = useLocation();
    const currentRole = getUserRole();

    if (!isAuthenticated()) {
        // Redirect to login, preserving the intended destination
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Role-based access check
    if (allowedRoles && !allowedRoles.includes(currentRole)) {
        // Redirect based on role
        if (currentRole === 'delivery_agent') {
            return <Navigate to="/agent/dashboard" replace />;
        }
        return <Navigate to="/" replace />;
    }

    return children;
}
