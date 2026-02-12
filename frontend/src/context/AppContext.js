import { useState, useEffect, createContext, useContext } from 'react';
import api from '../api/axios';  // Use the configured axios instance

// Re-export api for backward compatibility
export { default as api, API_BASE_URL } from '../api/axios';

// Company Name Context
const CompanyNameContext = createContext();

export function useCompanyName() {
    return useContext(CompanyNameContext);
}

export function CompanyNameProvider({ children }) {
    // Initialize from localStorage to avoid "Thanni Canuuu" flash
    const [companyName, setCompanyName] = useState(() => {
        return localStorage.getItem('company_name') || 'Thanni Canuuu';
    });
    const [logoUrl, setLogoUrl] = useState(() => {
        return localStorage.getItem('logo_url') || null;
    });
    // Add vendor state for reactive updates
    const [vendor, setVendor] = useState(() => {
        const stored = localStorage.getItem('vendor');
        try {
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });
    // User role state
    const [userRole, setUserRoleState] = useState(() => {
        return localStorage.getItem('user_role') || 'vendor';
    });
    const [loading, setLoading] = useState(true);

    // Role helpers
    const isAgent = userRole === 'delivery_agent';
    const isVendor = userRole === 'vendor';

    const setUserRole = (role) => {
        setUserRoleState(role);
        localStorage.setItem('user_role', role);
    };

    const loadSettings = async () => {
        try {
            // Agents skip company settings (they don't have vendor-level access)
            if (userRole !== 'delivery_agent') {
                // 1. Fetch Company Name
                const response = await api.get('/app-settings');
                const newName = response.data.company_name || 'Thanni Canuuu';
                setCompanyName(newName);
                localStorage.setItem('company_name', newName);

                // 2. Fetch Logo
                const logoRes = await api.get('/app-settings/logo');
                let url = logoRes.data.logo_url;

                if (url && url.startsWith('/static')) {
                    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
                    url = `${backendUrl}${url}`;
                }

                setLogoUrl(url);
                if (url) {
                    localStorage.setItem('logo_url', url);
                } else {
                    localStorage.removeItem('logo_url');
                }
            }

            // 3. Fetch/Sync User Info (works for both roles)
            const userRes = await api.get('/auth/me');
            if (userRes.data) {
                setVendor(userRes.data);
                localStorage.setItem('vendor', JSON.stringify(userRes.data));
                // Update role from server response
                if (userRes.data.role) {
                    setUserRole(userRes.data.role);
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateCompanyName = (name) => {
        setCompanyName(name);
        localStorage.setItem('company_name', name);
    };

    const updateLogoUrl = (url) => {
        setLogoUrl(url);
        if (url) {
            localStorage.setItem('logo_url', url);
        } else {
            localStorage.removeItem('logo_url');
        }
    };

    const updateVendor = (vendorData) => {
        setVendor(vendorData);
        localStorage.setItem('vendor', JSON.stringify(vendorData));
    };

    useEffect(() => {
        loadSettings();
    }, []);

    return (
        <CompanyNameContext.Provider value={{
            companyName,
            setCompanyName: updateCompanyName,
            logoUrl,
            setLogoUrl: updateLogoUrl,
            vendor,
            setVendor: updateVendor,
            userRole,
            setUserRole,
            isAgent,
            isVendor,
            refreshCompanyName: loadSettings,
            loading
        }}>
            {children}
        </CompanyNameContext.Provider>
    );
}

