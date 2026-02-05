/**
 * PrivateRoute Component
 * Protects routes that require authentication
 */
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../api/axios';

export default function PrivateRoute({ children }) {
    const location = useLocation();

    if (!isAuthenticated()) {
        // Redirect to login, preserving the intended destination
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}
